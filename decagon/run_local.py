#!/usr/bin/env python3
"""Run a Decagon Browser Action tool script locally against the mock portals.

Mimics the harness: provides a Playwright `page`, injects tool variables as
globals, wraps the script in a function so top-level `return` works, and stubs
`Conversation` / `lib.DecagonRequest` so `_shot()` writes files to ./shots/.

Usage:
  .venv/bin/python run_local.py tools/lookup_enrollment.py --var mobile_number=6155550101
  .venv/bin/python run_local.py tools/file_claim.py --var mobile_number=6155550101 \
      --var loss_type="Cracked Screen" --var incident_date=today --var description="Dropped it" --var imei=356789104512345
  .venv/bin/python run_local.py tools/book_repair.py --var zip=37203 --var device_model="iPhone 15 Pro" \
      --var repair_type="Screen Repair" --var claim_number=CLM-2026-0048213 --var customer_name="Maria Alvarez"

Options: --base URL (default http://localhost:3000)  --headed  --shots  --slowmo MS
Credentials come from env ENROLLMENT_USERNAME/PASSWORD etc., defaulting to the portal defaults.
"""
import argparse
import json
import os
import sys
import textwrap
import time
import types
from pathlib import Path

HERE = Path(__file__).resolve().parent


def build_namespace(page, variables, shots_dir):
    # Stub Decagon runtime objects used by _shot()
    class Conversation:
        @staticmethod
        def write_message(msg):
            print(f"[Conversation.write_message]\n{msg}")

        @staticmethod
        def log_error(msg):
            print(f"[Conversation.log_error] {msg}", file=sys.stderr)

    class DecagonRequest:
        @staticmethod
        def create_conversation_file_from_base64_upload(filename, b64):
            import base64
            shots_dir.mkdir(parents=True, exist_ok=True)
            path = shots_dir / filename
            path.write_bytes(base64.b64decode(b64))
            return f"file://{path}"

    lib_mod = types.ModuleType("lib")
    dr_mod = types.ModuleType("lib.DecagonRequest")
    dr_mod.DecagonRequest = DecagonRequest
    lib_mod.DecagonRequest = dr_mod
    sys.modules["lib"] = lib_mod
    sys.modules["lib.DecagonRequest"] = dr_mod

    ns = {"__name__": "__decagon_tool__", "page": page, "Conversation": Conversation}
    ns.update(variables)
    return ns


def run_tool(script_path, variables, base_url, headed=False, shots=False, slowmo=0):
    from playwright.sync_api import sync_playwright

    src = Path(script_path).read_text()
    if shots:
        src = src.replace("DEBUG_SHOTS = False", "DEBUG_SHOTS = True")
    wrapped = "def __decagon_tool__():\n" + textwrap.indent(src, "    ") + "\n__result__ = __decagon_tool__()\n"
    code = compile(wrapped, str(script_path), "exec")

    defaults = {
        "PORTAL_BASE_URL": base_url,
        "ENROLLMENT_USERNAME": os.environ.get("ENROLLMENT_USERNAME", "decagon.svc"),
        "ENROLLMENT_PASSWORD": os.environ.get("ENROLLMENT_PASSWORD", "Enr0ll-2026!"),
        "CLAIMS_USERNAME": os.environ.get("CLAIMS_USERNAME", "decagon.svc"),
        "CLAIMS_PASSWORD": os.environ.get("CLAIMS_PASSWORD", "Cl@ims-2026!"),
        "SCHEDULER_USERNAME": os.environ.get("SCHEDULER_USERNAME", "decagon.svc"),
        "SCHEDULER_PASSWORD": os.environ.get("SCHEDULER_PASSWORD", "Sch3d-2026!"),
    }
    defaults.update(variables)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=not headed, slow_mo=slowmo)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.set_default_timeout(15000)
        ns = build_namespace(page, defaults, HERE / "shots")
        t0 = time.perf_counter()
        try:
            exec(code, ns)
            result = ns.get("__result__")
            elapsed = time.perf_counter() - t0
            return result, elapsed, None
        except Exception as e:  # noqa: BLE001
            elapsed = time.perf_counter() - t0
            try:
                (HERE / "shots").mkdir(exist_ok=True)
                page.screenshot(path=str(HERE / "shots" / "FAILURE.png"), full_page=True)
            except Exception:
                pass
            return None, elapsed, f"{type(e).__name__}: {e}"
        finally:
            browser.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("--var", action="append", default=[], help="name=value (repeatable)")
    ap.add_argument("--base", default=os.environ.get("PORTAL_BASE_URL", "http://localhost:3000"))
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--shots", action="store_true", help="enable _shot() captures to ./shots/")
    ap.add_argument("--slowmo", type=int, default=0)
    args = ap.parse_args()

    variables = {}
    for kv in args.var:
        k, _, v = kv.partition("=")
        variables[k.strip()] = v
    result, elapsed, err = run_tool(args.script, variables, args.base, args.headed, args.shots, args.slowmo)
    print(json.dumps(result, indent=2) if err is None else f"TOOL ERROR after {elapsed:.2f}s: {err}")
    print(f"--- {Path(args.script).name} finished in {elapsed:.2f}s", file=sys.stderr)
    sys.exit(0 if err is None else 1)


if __name__ == "__main__":
    main()
