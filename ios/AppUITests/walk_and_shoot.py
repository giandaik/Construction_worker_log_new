"""Run ScreenWalkTests and screenshot each screen the moment it announces READY.

The test blocks on a `sleep` after printing READY:<name>, so the host has a
window in which the simulator is sitting on exactly that screen.
"""
import os
import re
import subprocess
import sys
import time

UDID = "5FC3C6AA-79BE-4E09-9FD4-16EDE6953E9F"
HERE = os.path.expanduser("~/Construction_worker_log_new/ios/AppUITests")
OUT = sys.argv[1]
SELECTOR = sys.argv[2] if len(sys.argv) > 2 else "AppUITests/ScreenWalkTests/testWalkAllScreens"
LOG = os.path.join(os.environ["TMPDIR"], f"walk-{SELECTOR.rsplit('/', 1)[-1]}.log")
DEVELOPER = "/Applications/Xcode.app/Contents/Developer"

os.makedirs(OUT, exist_ok=True)
logfh = open(LOG, "w")

proc = subprocess.Popen(
    [sys.executable, "run_uitest.py", SELECTOR, LOG],
    cwd=HERE,
    stdout=logfh,
    stderr=subprocess.STDOUT,
    env=dict(os.environ, DEVELOPER_DIR=DEVELOPER),
)

seen = set()
deadline = time.time() + 900
while time.time() < deadline:
    if os.path.exists(LOG):
        text = open(LOG, errors="ignore").read()
        for name in re.findall(r"READY:([\w-]+)", text):
            if name in seen:
                continue
            seen.add(name)
            path = os.path.join(OUT, f"{name}.png")
            r = subprocess.run(
                ["xcrun", "simctl", "io", UDID, "screenshot", "--type=png", path],
                capture_output=True, text=True,
                env=dict(os.environ, DEVELOPER_DIR=DEVELOPER),
            )
            print(f"SHOT {name} -> {path} rc={r.returncode} {r.stderr.strip()[:80]}", flush=True)
        if "WALK-DONE" in text or "TEST FAILED" in text or "TEST SUCCEEDED" in text:
            if "WALK-DONE" in text:
                break
    if proc.poll() is not None and ("TEST SUCCEEDED" in open(LOG, errors="ignore").read() or "TEST FAILED" in open(LOG, errors="ignore").read()):
        break
    time.sleep(0.4)

print("done, shots:", sorted(seen))
print("failures:", re.findall(r"FAIL:(\w+)", open(LOG, errors="ignore").read()))
