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
PORT = 9666
USER_DIR = os.path.abspath(r"scratch\chrome_cdp_profile_9666")
URL = "http://localhost:5173/"

async def run():
    cmd = [
        CHROME,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        f"--user-data-dir={USER_DIR}",
        "--disable-gpu",
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

            print("Navigating...")
            await send_cmd("Page.navigate", {"url": URL})
            await asyncio.sleep(2.5)

            # Check buttons on page
            btns = await send_cmd("Runtime.evaluate", {
                "expression": "Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim())",
                "returnByValue": True
            })
            print("Buttons found:", btns.get("result", {}).get("result", {}).get("value"))

            # Click Watch Overview
            click_res = await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Watch Overview'));
                    if (btn) {
                        btn.click();
                        return "Clicked Watch Overview";
                    }
                    return "Button not found";
                })()
                """,
                "returnByValue": True
            })
            print("Click result:", click_res.get("result", {}).get("result", {}).get("value"))

            await asyncio.sleep(0.8)

            # Check if modal is present
            modal_check = await send_cmd("Runtime.evaluate", {
                "expression": "document.querySelector('.lp-modal-dialog')?.innerText",
                "returnByValue": True
            })
            print("Modal content:", modal_check.get("result", {}).get("result", {}).get("value"))

            # Close current modal
            await send_cmd("Runtime.evaluate", {"expression": "document.querySelector('.lp-modal-close')?.click()"})
            await asyncio.sleep(0.5)

            # Click Watch Demo
            click_res = await send_cmd("Runtime.evaluate", {
                "expression": """
                (() => {
                    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Watch Demo'));
                    if (btn) {
                        btn.click();
                        return "Clicked Watch Demo";
                    }
                    return "Button not found";
                })()
                """,
                "returnByValue": True
            })
            print("Click result:", click_res.get("result", {}).get("result", {}).get("value"))
            await asyncio.sleep(0.8)

            # Screenshot
            res = await send_cmd("Page.captureScreenshot", {"format": "png"})
            with open(r"scratch\modal_demo_verified.png", "wb") as f:
                f.write(base64.b64decode(res["result"]["data"]))
            print("Saved scratch\\modal_demo_verified.png")

    finally:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(run())
