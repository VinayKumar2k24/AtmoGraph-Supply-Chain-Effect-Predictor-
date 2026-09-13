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
PORT = 9444
USER_DIR = os.path.abspath(r"scratch\chrome_cdp_profile_9444")
URL = "http://localhost:5173/"

async def run_cdp():
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
    print("Starting Chrome...")
    proc = subprocess.Popen(cmd)
    
    # Wait for remote debugging endpoint to be ready
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
        except Exception as e:
            pass

    if not ws_url:
        print("Failed to get WebSocket debugger URL")
        proc.terminate()
        return

    print("Connected to target:", ws_url)

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
                    elif data.get("method") == "Runtime.consoleAPICalled":
                        args = data.get("params", {}).get("args", [])
                        text = " ".join(str(a.get("value", a.get("description", ""))) for a in args)
                        print(f"[Console {data.get('params',{}).get('type')}]:", text)

            await send_cmd("Page.enable")
            await send_cmd("Runtime.enable")
            await send_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1440,
                "height": 900,
                "deviceScaleFactor": 1,
                "mobile": False
            })

            print(f"Navigating to {URL} ...")
            await send_cmd("Page.navigate", {"url": URL})

            # Allow React & assets to load and render
            print("Waiting for page load...")
            await asyncio.sleep(3)

            # Capture viewport (Hero + stats)
            print("Capturing viewport screenshot...")
            res1 = await send_cmd("Page.captureScreenshot", {"format": "png"})
            if "result" in res1 and "data" in res1["result"]:
                with open(r"scratch\hero_viewport.png", "wb") as f:
                    f.write(base64.b64decode(res1["result"]["data"]))
                print("Saved scratch\\hero_viewport.png successfully!")

            # Evaluate page title and header
            eval_res = await send_cmd("Runtime.evaluate", {
                "expression": "document.title + ' | H1: ' + (document.querySelector('h1')?.innerText || 'No H1')"
            })
            print("Page Eval:", eval_res.get("result", {}).get("result", {}).get("value"))

            # Check if all images loaded
            img_check = await send_cmd("Runtime.evaluate", {
                "expression": """
                    JSON.stringify(Array.from(document.querySelectorAll('img')).map(i => ({
                        src: i.src.split('/').pop().split('?')[0],
                        complete: i.complete,
                        naturalWidth: i.naturalWidth,
                        naturalHeight: i.naturalHeight
                    })))
                """
            })
            print("Image status:", img_check.get("result", {}).get("result", {}).get("value"))

            # Capture full page screenshot
            print("Capturing full page final screenshot...")
            res2 = await send_cmd("Page.captureScreenshot", {
                "format": "png",
                "captureBeyondViewport": True
            })
            if "result" in res2 and "data" in res2["result"]:
                with open(r"scratch\full_page_final.png", "wb") as f:
                    f.write(base64.b64decode(res2["result"]["data"]))
                print("Saved scratch\\full_page_final.png successfully!")

    except Exception as err:
        print("Error during CDP execution:", err)
    finally:
        proc.terminate()
        print("Chrome terminated cleanly.")

if __name__ == "__main__":
    asyncio.run(run_cdp())
