# Decagon Browser Action tool: lookup_enrollment
#
# Logs into the legacy Carrier Enrollment Portal (no API), searches a subscriber by
# mobile number, and reads plan, enrollment status, device, deductibles, and
# 12-month claim history off the detail page.
#
# Tool variables (declare on the tool; they arrive as Python globals by name):
#   mobile_number        Conversation History, String   customer's 10-digit mobile number, any format
#   PORTAL_BASE_URL      Secret or constant             e.g. https://protectco-demo.onrender.com
#   ENROLLMENT_USERNAME  Secret (Hide from context)     service account user id
#   ENROLLMENT_PASSWORD  Secret (Hide from context)     service account password
#
# `page` is the Playwright Page the Browser Actions harness provides.
# Output follows Decagon tool best practices: every return has `status` and `error`
# (`error` is None on success). Set DEBUG_SHOTS = True during rehearsal only.

import re
import base64

DEBUG_SHOTS = False
BASE = PORTAL_BASE_URL.rstrip("/")


def _shot(label):
    """Full-page screenshot + DOM snapshot posted to the conversation. Debug aid only."""
    if not DEBUG_SHOTS:
        return
    try:
        from lib.DecagonRequest import DecagonRequest
        try:
            page.evaluate(
                "() => { for (const el of document.querySelectorAll('body *')) {"
                "  const p = getComputedStyle(el).position;"
                "  if (p === 'fixed' || p === 'sticky') el.style.setProperty('position', 'static', 'important'); }"
                " window.scrollTo(0, 0); }"
            )
        except Exception:
            pass
        png = page.screenshot(full_page=True)
        img_url = DecagonRequest.create_conversation_file_from_base64_upload(f"{label}.png", base64.b64encode(png).decode())
        dom_url = DecagonRequest.create_conversation_file_from_base64_upload(f"{label}.html", base64.b64encode(page.content().encode()).decode())
        lines = [l for l in [img_url and f"image: {img_url}", dom_url and f"DOM: {dom_url}"] if l]
        if lines:
            Conversation.write_message("\n".join(lines))
    except Exception:
        pass


def _text(selector):
    loc = page.locator(selector)
    return loc.first.inner_text().strip() if loc.count() else None


def _digits(s):
    return re.sub(r"\D", "", s or "")


def _fail(code, message, **extra):
    return {"status": "error", "found": False, "error": code, "message": message, **extra}


def _run():
    mobile = _digits(mobile_number)
    if len(mobile) == 11 and mobile.startswith("1"):
        mobile = mobile[1:]
    if len(mobile) != 10:
        return _fail("invalid_mobile", f"mobile_number must be 10 digits, got '{mobile_number}'")

    # --- 1. Login (every run starts from a fresh browser) ------------------------
    page.goto(f"{BASE}/enrollment/login", wait_until="domcontentloaded")
    page.fill("#username", ENROLLMENT_USERNAME)
    page.fill("#password", ENROLLMENT_PASSWORD)
    page.click("#login-submit")
    page.wait_for_selector("#mobile_number, #login-error", timeout=15000)
    if page.locator("#login-error").count():
        Conversation.log_error("lookup_enrollment: portal login failed: " + (_text("#login-error") or ""))
        return _fail("portal_login_failed", "Could not sign in to the enrollment portal.")
    _shot("enrollment-01-logged-in")

    # --- 2. Search by mobile number ----------------------------------------------
    page.fill("#mobile_number", mobile)
    page.click("#search-submit")
    page.wait_for_selector("#sub-name, #search-error", timeout=15000)
    if page.locator("#search-error").count():
        return _fail("subscriber_not_found", _text("#search-error"), mobile_number=mobile)
    _shot("enrollment-02-subscriber-detail")

    # --- 3. Read the subscriber detail page ---------------------------------------
    deductibles = {}
    for row in page.locator("#deductible-table tr[data-loss-type]").all():
        amt = row.locator(".deductible").get_attribute("data-amount")
        deductibles[row.get_attribute("data-loss-type")] = float(amt) if amt not in (None, "") else None

    claims = []
    for row in page.locator("#claims-table tr.claim-row").all():
        claims.append({
            "claim_number": row.locator(".claim-number").inner_text().strip(),
            "date": row.locator(".claim-date").inner_text().strip(),
            "loss_type": row.locator(".claim-loss-type").inner_text().strip(),
            "status": row.locator(".claim-status").inner_text().strip(),
        })

    status = _text("#sub-status")
    claim_limit = _text("#claim-limit")
    claims_remaining = _text("#claims-remaining")

    return {
        "status": "success",
        "error": None,
        "found": True,
        "subscriber_id": _text("#sub-id"),
        "name": _text("#sub-name"),
        "mobile_number": mobile,
        "carrier": _text("#sub-carrier"),
        "plan": _text("#sub-plan"),
        "enrollment_status": status,
        "is_enrolled": status == "Active",
        "device_make": _text("#dev-make"),
        "device_model": _text("#dev-model"),
        "device_imei": _text("#dev-imei"),
        "deductibles": deductibles,
        "cracked_screen_deductible": deductibles.get("Cracked Screen"),
        "claim_limit_12mo": int(claim_limit) if claim_limit and claim_limit.isdigit() else None,
        "claims_last_12mo_count": len(claims),
        "claims_remaining": int(claims_remaining) if claims_remaining and claims_remaining.isdigit() else None,
        "claims_last_12mo": claims,
        "portal_banner": _text("#status-banner"),
    }


try:
    return _run()
except Exception as e:  # selector timeout, navigation failure, etc.
    Conversation.log_error(f"lookup_enrollment browser flow failed: {type(e).__name__}: {e}")
    return _fail("browser_flow_failed", "The enrollment portal did not respond as expected.", detail=str(e)[:300])
