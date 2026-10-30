# Decagon Browser Action tool: file_claim
#
# Logs into the legacy Claims Adjudication Console (no API), starts a New Claim,
# looks up the subscriber, fills the loss details, submits, and reads the claim
# number, adjudication status, and deductible due off the confirmation page.
#
# Tool variables (declare on the tool; they arrive as Python globals by name):
#   mobile_number     Conversation History, String
#   loss_type         Conversation History, Enum: Cracked Screen | Physical Damage | Liquid Damage | Loss | Theft | Malfunction
#   incident_date     Conversation History, String   YYYY-MM-DD, or "today"
#   description       Conversation History, String   short description in the customer's words
#   imei              Tool Output (lookup_enrollment -> device_imei) or Conversation History
#   PORTAL_BASE_URL   Secret or constant
#   CLAIMS_USERNAME   Secret (Hide from context)
#   CLAIMS_PASSWORD   Secret (Hide from context)

import re
import base64
import datetime

DEBUG_SHOTS = False
BASE = PORTAL_BASE_URL.rstrip("/")
LOSS_TYPES = ["Cracked Screen", "Physical Damage", "Liquid Damage", "Loss", "Theft", "Malfunction"]


def _shot(label):
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
    return {"status": "error", "success": False, "error": code, "message": message, **extra}


def _normalize_loss_type(raw):
    r = (raw or "").strip().lower()
    for lt in LOSS_TYPES:
        if r == lt.lower():
            return lt
    if "screen" in r or "crack" in r:
        return "Cracked Screen"
    if "liquid" in r or "water" in r:
        return "Liquid Damage"
    if "theft" in r or "stolen" in r:
        return "Theft"
    if "lost" in r or "loss" in r:
        return "Loss"
    if "malfunction" in r or "not working" in r or "won't turn on" in r:
        return "Malfunction"
    if "damage" in r or "broke" in r or "drop" in r:
        return "Physical Damage"
    return None


def _run():
    mobile = _digits(mobile_number)
    if len(mobile) == 11 and mobile.startswith("1"):
        mobile = mobile[1:]
    lt = _normalize_loss_type(loss_type)
    if lt is None:
        return _fail("invalid_loss_type", f"Unrecognized loss_type '{loss_type}'. Use one of: {', '.join(LOSS_TYPES)}")
    date_str = (incident_date or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        date_str = datetime.date.today().isoformat()
    imei_digits = _digits(imei)
    if not imei_digits:
        return _fail("missing_imei", "imei is required. Use device_imei from lookup_enrollment.")
    desc = (description or "").strip() or f"Customer reports {lt.lower()}."

    # --- 1. Login -----------------------------------------------------------------
    page.goto(f"{BASE}/claims/login", wait_until="domcontentloaded")
    page.fill("#username", CLAIMS_USERNAME)
    page.fill("#password", CLAIMS_PASSWORD)
    page.click("#login-submit")
    page.wait_for_selector("#new-claim-btn, #login-error", timeout=15000)
    if page.locator("#login-error").count():
        Conversation.log_error("file_claim: portal login failed: " + (_text("#login-error") or ""))
        return _fail("portal_login_failed", "Could not sign in to the claims console.")
    _shot("claims-01-work-queue")

    # --- 2. New Claim -> Step 1 subscriber lookup ---------------------------------
    page.click("#new-claim-btn")
    page.wait_for_selector("#mobile_number", timeout=15000)
    page.fill("#mobile_number", mobile)
    page.click("#lookup-submit")
    page.wait_for_selector("#loss_type, #lookup-error", timeout=15000)
    if page.locator("#lookup-error").count():
        return _fail("subscriber_not_found", _text("#lookup-error"))
    _shot("claims-02-loss-details-form")

    # --- 3. Step 2 loss details -----------------------------------------------------
    page.select_option("#loss_type", lt)
    page.fill("#incident_date", date_str)
    page.fill("#description", desc[:500])
    page.fill("#imei", imei_digits)
    _shot("claims-03-form-filled")
    page.click("#submit-claim")
    page.wait_for_selector("#claim-number, #claim-error", timeout=15000)
    if page.locator("#claim-error").count():
        return _fail("claim_rejected", _text("#claim-error"))
    _shot("claims-04-confirmation")

    # --- 4. Read confirmation --------------------------------------------------------
    status = _text("#claim-status")
    deductible_attr = page.locator("#deductible-due").get_attribute("data-amount")
    return {
        "status": "success",
        "error": None,
        "success": True,
        "claim_number": _text("#claim-number"),
        "claim_status": status,
        "approved": status == "Approved",
        "deductible_due": float(deductible_attr) if deductible_attr not in (None, "", "null") else None,
        "deductible_due_display": _text("#deductible-due"),
        "adjudication_note": _text("#adjudication-reason"),
        "fulfillment": _text("#fulfillment"),
        "loss_type": lt,
        "incident_date": date_str,
        "subscriber": _text("#claim-subscriber"),
    }


try:
    return _run()
except Exception as e:
    Conversation.log_error(f"file_claim browser flow failed: {type(e).__name__}: {e}")
    return _fail("browser_flow_failed", "The claims console did not respond as expected.", detail=str(e)[:300])
