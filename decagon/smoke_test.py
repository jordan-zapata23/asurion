#!/usr/bin/env python3
"""End-to-end smoke test: runs every demo scenario through the real tool scripts
in headless Chromium and checks the outputs the AOP depends on.

  .venv/bin/python smoke_test.py                 # against http://localhost:3000
  .venv/bin/python smoke_test.py --base https://your-deploy.onrender.com

Exit code 0 = all scenarios pass. Prints per-tool latency so you can watch the
2-5 s budget the Browser Actions harness expects (the portals themselves add well
under a second; the rest is the harness's browser startup).
"""
import argparse
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run_local import run_tool  # noqa: E402

HERE = Path(__file__).resolve().parent
TOOLS = HERE / "tools"
HERO = {"mobile": "6155550101", "name": "Maria Alvarez", "imei": "356789104512345", "model": "iPhone 15 Pro", "zip": "37203"}
failures = []


def check(label, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    print(f"  [{status}] {label}{(' - ' + str(detail)) if detail and not cond else ''}")
    if not cond:
        failures.append(label)


def run(tool, label, **variables):
    result, elapsed, err = run_tool(TOOLS / tool, variables, BASE)
    print(f"\n{label}  ({tool}, {elapsed:.2f}s)")
    if err:
        print(f"  [FAIL] tool error: {err}")
        failures.append(f"{label}: {err}")
        return {}
    check("completed under 5s", elapsed < 5, f"{elapsed:.2f}s")
    return result or {}


ap = argparse.ArgumentParser()
ap.add_argument("--base", default="http://localhost:3000")
ap.add_argument("--no-reset", action="store_true", help="skip POST /admin/reset before running")
BASE = ap.parse_args().base.rstrip("/")

if not ap.parse_args().no_reset:
    urllib.request.urlopen(urllib.request.Request(f"{BASE}/admin/reset", method="POST", data=b""))
    print(f"Reset demo data at {BASE}/admin/reset")

# 1. Happy path -----------------------------------------------------------------
r = run("lookup_enrollment.py", "Happy path: lookup", mobile_number="(615) 555-0101")
check("found + enrolled", r.get("found") and r.get("is_enrolled"))
check("device is iPhone 15 Pro", r.get("device_model") == HERO["model"], r.get("device_model"))
check("cracked screen deductible is $29", r.get("cracked_screen_deductible") == 29.0)
check("claims remaining > 0", (r.get("claims_remaining") or 0) > 0, r.get("claims_remaining"))

r = run("file_claim.py", "Happy path: file claim", mobile_number=HERO["mobile"], loss_type="cracked screen",
        incident_date="today", description="Dropped on concrete, screen shattered", imei=r.get("device_imei", HERO["imei"]))
claim = r.get("claim_number")
check("claim number is CLM-2026-0048213 (fresh reset)", claim == "CLM-2026-0048213", claim)
check("auto-approved", r.get("approved") is True, r.get("claim_status"))
check("deductible due $29", r.get("deductible_due") == 29.0)

r = run("book_repair.py", "Happy path: book repair", zip=HERO["zip"], device_model="Apple iPhone 15 Pro", repair_type="screen",
        claim_number=claim or "CLM-2026-0048213", customer_name=HERO["name"])
check("booking succeeded", r.get("success") is True, r.get("error"))
check("booked at The Gulch (nearest WITH parts)", "Gulch" in (r.get("store_name") or ""), r.get("store_name"))
check("skipped Midtown (nearest, NO parts)", any("Midtown" in s["name"] for s in r.get("skipped_stores", [])))
check("appointment time present", bool(r.get("appointment_time")))
check("what-to-bring has 6 items", len(r.get("what_to_bring", [])) == 6)

# 2. Edge: claim limit ------------------------------------------------------------
r = run("lookup_enrollment.py", "Edge: claim limit", mobile_number="6155550102")
check("claims_remaining is 0 (AOP decides to stop)", r.get("claims_remaining") == 0, r.get("claims_remaining"))
check("2 claims in history", r.get("claims_last_12mo_count") == 2)

r = run("file_claim.py", "Edge: claim limit -> file anyway (AOP should NOT do this; verifies portal rule)",
        mobile_number="6155550102", loss_type="Cracked Screen", incident_date="2026-10-29", description="Cracked again", imei="356789104598711")
check("portal returns Pending Review", r.get("claim_status") == "Pending Review", r.get("claim_status"))

# 3. Edge: not enrolled ------------------------------------------------------------
r = run("lookup_enrollment.py", "Edge: not enrolled", mobile_number="6155550103")
check("is_enrolled false", r.get("is_enrolled") is False)
check("status Not Enrolled", r.get("enrollment_status") == "Not Enrolled")

# 4. Edge: device mismatch (enrolled Galaxy S23; customer says iPhone) ------------------
r = run("lookup_enrollment.py", "Edge: device mismatch", mobile_number="6155550104")
check("enrolled device is Galaxy S23", r.get("device_model") == "Galaxy S23", r.get("device_model"))

# 5. Edge: unknown number ------------------------------------------------------------
r = run("lookup_enrollment.py", "Edge: unknown number", mobile_number="6155559999")
check("found false with subscriber_not_found + portal text", r.get("found") is False and r.get("error") == "subscriber_not_found" and "No subscriber" in (r.get("message") or ""), r)

# 6. Edge: wrong credentials ----------------------------------------------------------------
res, _, err = run_tool(TOOLS / "lookup_enrollment.py", {"mobile_number": HERO["mobile"], "ENROLLMENT_PASSWORD": "wrong"}, BASE)
print("\nEdge: bad credentials")
check("login failure surfaced cleanly", err is None and res and res.get("found") is False and res.get("error") == "portal_login_failed", err or res)

# 7. Edge: portal unreachable -> structured error, not an exception -------------------------
res, _, err = run_tool(TOOLS / "lookup_enrollment.py", {"mobile_number": HERO["mobile"], "PORTAL_BASE_URL": "http://localhost:9"}, BASE)
print("\nEdge: portal unreachable")
check("browser failure returned as structured error", err is None and res and res.get("error") == "browser_flow_failed", err or res)

# 8. Output size stays under the 2,000-token tool output cap (approx 4 chars/token) -----------------
import json as _json
r = run("book_repair.py", "Output size: book_repair", zip=HERO["zip"], device_model=HERO["model"], repair_type="Screen Repair",
        claim_number="CLM-2026-0048213", customer_name=HERO["name"])
size = len(_json.dumps(r))
check("book_repair output under ~6000 chars", size < 6000, f"{size} chars")

print("\n" + ("ALL SCENARIOS PASSED" if not failures else f"{len(failures)} FAILURE(S): " + "; ".join(failures)))
sys.exit(1 if failures else 0)
