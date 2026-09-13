import subprocess
import time
import json
import urllib.request
import base64
import os

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9222
USER_DIR = os.path.abspath(r"scratch\chrome_cdp_profile")

cmd = [
    CHROME,
    "--headless=new",
    f"--remote-debugging-port={PORT}",
    f"--user-data-dir={USER_DIR}",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
]

proc = subprocess.Popen(cmd)
time.sleep(2)

try:
    # Query targets
    targets_url = f"http://127.0.0.1:{PORT}/json"
    req = urllib.request.urlopen(targets_url)
    targets = json.loads(req.read().decode("utf-8"))
    print("Targets:", targets)
    
    # We need a websocket client or we can use the /json/new endpoint
    # Or even simpler: python's built-in websockets or standard library
except Exception as e:
    print("Error:", e)
finally:
    proc.terminate()
