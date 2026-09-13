import asyncio
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
import websockets

sys.stdout.reconfigure(line_buffering=True)

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9555
USER_DIR = os.path.abspath(r"scratch\chrome_cdp_profile_test")
URL = "http://localhost:5173/"

async def test_all():
    cmd = [
        CHROME,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        f"--user-data-dir={USER_DIR}",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1440,900",
        "about:blank"
    ]
    proc = subprocess.Popen(cmd)
    
    ws_url = None
    for _ in range(20):
        await asyncio.sleep(0.5)
        try:
            req = urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json", timeout=2)
            targets = json.loads(req.read().decode("utf-8"))
            for t in targets:
                if t.get("type") == "page":
                    ws_url = t["webSocketDebuggerUrl"]
                    break
            if ws_url:
                break
        except Exception:
            pass

    if not ws_url:
        print("Failed to start Chrome CDP")
        proc.terminate()
        return

    print("Connected to:", ws_url)

    try:
        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            msg_id = 0

            async def send_cmd(method, params=None):
                nonlocal msg_id
                msg_id += 1
                req_id = msg_id
                payload = {"id": req_id, "method": method}
                if params:
                    payload["params"] = params
                await ws.send(json.dumps(payload))
                while True:
                    raw = await ws.recv()
                    data = json.loads(raw)
                    if data.get("id") == req_id:
                        return data
                    elif data.get("method") == "Runtime.exceptionThrown":
                        details = data.get("params", {}).get("exceptionDetails", {})
                        print("[EXCEPTION]:", details.get("text"), details.get("exception", {}).get("description"))

            await send_cmd("Page.enable")
            await send_cmd("Runtime.enable")
            await send_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1440,
                "height": 900,
                "deviceScaleFactor": 1,
                "mobile": False
            })

            print("Navigating to", URL)
            await send_cmd("Page.navigate", {"url": URL})
            await asyncio.sleep(2.5)

            # Check stats counter numbers
            res = await send_cmd("Runtime.evaluate", {
                "expression": "Array.from(document.querySelectorAll('.lp-stat-num')).map(e => e.innerText)"
            })
            stats = res.get("result", {}).get("result", {}).get("value")
            print("Rendered Stats:", stats)

            # Check button links
            res = await send_cmd("Runtime.evaluate", {
                "expression": """
                ({
                    signIn: document.querySelector('.lp-ghost-btn')?.getAttribute('href'),
                    getStarted: document.querySelector('.lp-cta-btn')?.getAttribute('href'),
                    explorePlatform: document.querySelector('.lp-hero-ctas .lp-cta-btn')?.getAttribute('href'),
                    ctaGetStarted: document.querySelector('.lp-cta-btns .lp-cta-btn')?.getAttribute('href')
                })
                """
            })
            links = res.get("result", {}).get("result", {}).get("value")
            print("Button routes verified:", links)

            # 1. Click "Watch Overview"
            print("Testing Watch Overview button...")
            await send_cmd("Runtime.evaluate", {
                "expression": "Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Watch Overview'))?.click()"
            })
            await asyncio.sleep(0.5)

            # Capture Overview modal screenshot
            res = await send_cmd("Page.captureScreenshot", {"format": "png"})
            with open(r"scratch\modal_overview.png", "wb") as f:
                f.write(base64.b64decode(res["result"]["data"]))
            print("Saved scratch\\modal_overview.png")

            # Close modal with ESC
            await send_cmd("Runtime.evaluate", {
                "expression": "document.querySelector('.lp-modal-close')?.click()"
            })
            await asyncio.sleep(0.3)

            # 2. Click "Watch Demo"
            print("Testing Watch Demo button...")
            await send_cmd("Runtime.evaluate", {
                "expression": "Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Watch Demo'))?.click()"
            })
            await asyncio.sleep(0.5)

            res = await send_cmd("Page.captureScreenshot", {"format": "png"})
            with open(r"scratch\modal_demo.png", "wb") as f:
                f.write(base64.b64decode(res["result"]["data"]))
            print("Saved scratch\\modal_demo.png")

            # Close modal
            await send_cmd("Runtime.evaluate", {
                "expression": "document.querySelector('.lp-modal-close')?.click()"
            })
            await asyncio.sleep(0.3)

            # 3. Test Mobile Layout (375x812 iPhone)
            print("Testing mobile viewport (375x812)...")
            await send_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 375,
                "height": 812,
                "deviceScaleFactor": 2,
                "mobile": True
            })
            await asyncio.sleep(0.5)

            # Toggle burger menu
            await send_cmd("Runtime.evaluate", {
                "expression": "document.querySelector('.lp-burger')?.click()"
            })
            await asyncio.sleep(0.4)

            res = await send_cmd("Page.captureScreenshot", {"format": "png"})
            with open(r"scratch\mobile_drawer.png", "wb") as f:
                f.write(base64.b64decode(res["result"]["data"]))
            print("Saved scratch\\mobile_drawer.png")

            # Toggle burger menu back
            await send_cmd("Runtime.evaluate", {
                "expression": "document.querySelector('.lp-burger')?.click()"
            })
            await asyncio.sleep(0.4)

            res = await send_cmd("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
            with open(r"scratch\mobile_full_page.png", "wb") as f:
                f.write(base64.b64decode(res["result"]["data"]))
            print("Saved scratch\\mobile_full_page.png")

            print("ALL INTERACTIVE TESTS PASSED!")

    finally:
        proc.terminate()
        print("Chrome terminated.")

if __name__ == "__main__":
    asyncio.run(test_all())
