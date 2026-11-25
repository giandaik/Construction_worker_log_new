"""Run an XCUITest selector on the simulator with CWL creds from the vault.

Secrets never leave this process: they go straight into xcodebuild's env via the
TEST_RUNNER_ prefix (XCTest strips it). Only derived facts are printed.
"""
import json
import os
import subprocess
import sys

SELECTOR = sys.argv[1] if len(sys.argv) > 1 else "AppUITests/LoginTests"
LOG = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.environ["TMPDIR"], "uitest-run.log")
UDID = os.environ.get("SIM_UDID", "5FC3C6AA-79BE-4E09-9FD4-16EDE6953E9F")
PROJ = os.path.expanduser("~/Construction_worker_log_new/ios/AppUITests")

BWS = os.path.expanduser("~/.hermes/bin/bws")
venv = dict(os.environ)
venv["BWS_SERVER_URL"] = "https://vault.bitwarden.eu"
rows = json.loads(subprocess.run([BWS, "secret", "list"], capture_output=True, text=True, env=venv, check=True).stdout)
secrets = {r["key"]: r["value"] for r in rows}
user = secrets.get("CWL_USER") or ""
pw = secrets.get("CWL_PASS") or ""
if not user or not pw:
    sys.exit("CWL_USER / CWL_PASS missing from vault")

run_env = dict(os.environ)
run_env["DEVELOPER_DIR"] = "/Applications/Xcode.app/Contents/Developer"
run_env["TEST_RUNNER_CWL_USER"] = user
run_env["TEST_RUNNER_CWL_PASS"] = pw

cmd = [
    "xcodebuild", "test",
    "-project", "AppUITests.xcodeproj",
    "-scheme", "AppUITests",
    "-destination", f"id={UDID}",
    "-derivedDataPath", "build",
    "CODE_SIGNING_ALLOWED=NO",
    f"-only-testing:{SELECTOR}",
]
print("running", SELECTOR, "| creds len", len(user), len(pw))
with open(LOG, "w") as fh:
    rc = subprocess.call(cmd, cwd=PROJ, env=run_env, stdout=fh, stderr=subprocess.STDOUT)
print("xcodebuild rc", rc, "| log", LOG)
