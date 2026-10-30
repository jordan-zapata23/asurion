# Decagon Browser Action tool: book_repair
#
# Logs into the legacy Repair Network Scheduler (no API), searches stores by ZIP,
# device model, and repair type, picks the nearest store that has parts in stock,
# books the earliest slot (or a preferred time), and reads the booking reference,
# store address, appointment time, and "what to bring" off the confirmation page.
#
# Tool variables (declare on the tool; they arrive as Python globals by name):
#   zip                 Conversation History, String   5-digit customer ZIP
#   device_model        Tool Output (lookup_enrollment -> device_model) or Conversation History
#   repair_type         Conversation History, Enum: Screen Repair | Battery Replacement | Back Glass | Charging Port | Diagnostic
#   claim_number        Tool Output (file_claim -> claim_number) or Conversation History
#   customer_name       Tool Output (lookup_enrollment -> name) or Conversation History
#   preferred_time      Conversation History, String, optional   e.g. "3:15 PM"
#   exclude_stores      Conversation History, String, optional   comma-separated store names the customer declined
#   PORTAL_BASE_URL     Secret or constant
#   SCHEDULER_USERNAME  Secret (Hide from context)
#   SCHEDULER_PASSWORD  Secret (Hide from context)
#
# Output is pruned to stay well under the 2,000-token tool output cap.

import re
import base64

DEBUG_SHOTS = False
BASE = PORTAL_BASE_URL.rstrip("/")
REPAIR_TYPES = ["Screen Repair", "Battery Replacement", "Back Glass", "Charging Port", "Diagnostic"]


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


def _fail(code, message, **extra):
    return {"status": "error", "success": False, "error": code, "message": message, **extra}


def _normalize_repair_type(raw):
    r = (raw or "").strip().lower()
    for rt in REPAIR_TYPES:
        if r == rt.lower():
            return rt
    if "screen" in r or "crack" in r or "display" in r:
        return "Screen Repair"
    if "batter" in r:
        return "Battery Replacement"
    if "back" in r or "glass" in r:
        return "Back Glass"
    if "charg" in r or "port" in r:
        return "Charging Port"
    return "Diagnostic"


def _opt(name):
    # Optional inputs may be absent, None, or "" depending on extraction. Treat all as empty.
    v = globals().get(name)
    return (v or "").strip() if isinstance(v, str) else ""


def _run():
    zip_code = re.sub(r"\D", "", zip or "")[:5]
    rt = _normalize_repair_type(repair_type)
    model = (device_model or "").strip()
    claim = (claim_number or "").strip().upper()
    name = (customer_name or "").strip()
    pref_time = _opt("preferred_time").lower()
    excluded = [s.strip().lower() for s in _opt("exclude_stores").split(",") if s.strip()]

    if len(zip_code) != 5:
        return _fail("invalid_zip", f"zip must be 5 digits, got '{zip}'")
    if not model:
        return _fail("missing_device_model", "device_model is required. Use device_model from lookup_enrollment.")
    if not claim:
        return _fail("missing_claim_number", "claim_number is required. Use claim_number from file_claim.")

    # --- 1. Login -----------------------------------------------------------------
    page.goto(f"{BASE}/scheduler/login", wait_until="domcontentloaded")
    page.fill("#username", SCHEDULER_USERNAME)
    page.fill("#password", SCHEDULER_PASSWORD)
    page.click("#login-submit")
    page.wait_for_selector("#zip, #login-error", timeout=15000)
    if page.locator("#login-error").count():
        Conversation.log_error("book_repair: portal login failed: " + (_text("#login-error") or ""))
        return _fail("portal_login_failed", "Could not sign in to the repair scheduler.")
    _shot("scheduler-01-search")

    # --- 2. Search stores ----------------------------------------------------------
    page.fill("#zip", zip_code)
    page.fill("#device_model", model)
    page.select_option("#repair_type", rt)
    page.click("#search-submit")
    page.wait_for_selector("#results-table, #search-error", timeout=15000)
    if page.locator("#search-error").count():
        return _fail("search_rejected", _text("#search-error"))
    _shot("scheduler-02-results")

    # --- 3. Pick the nearest store with parts in stock (results are distance-sorted) --
    candidates, skipped = [], []
    for row in page.locator("#results-table tr.store-row").all():
        store = {
            "store_id": row.get_attribute("data-store-id"),
            "name": row.locator(".store-name b").inner_text().strip(),
            "distance": row.locator(".distance").inner_text().strip(),
            "next_available": row.locator(".next-slot").inner_text().strip(),
        }
        parts = row.get_attribute("data-parts-in-stock") == "Y"
        if not parts:
            skipped.append({"name": store["name"], "distance": store["distance"], "reason": "no parts in stock"})
        elif store["name"].lower() in excluded:
            skipped.append({"name": store["name"], "distance": store["distance"], "reason": "declined by customer"})
        elif store["next_available"] == "None":
            skipped.append({"name": store["name"], "distance": store["distance"], "reason": "no open slots"})
        else:
            candidates.append(store)

    if not candidates:
        return _fail("no_store_available", f"No stores near {zip_code} have {model} parts for {rt} today.", skipped_stores=skipped)

    chosen = candidates[0]
    alternatives = [{k: c[k] for k in ("name", "distance", "next_available")} for c in candidates[1:3]]
    page.click(f"#select-store-{chosen['store_id']}")
    page.wait_for_selector("#slot", timeout=15000)
    _shot("scheduler-03-booking-form")

    # --- 4. Choose slot, fill claim + name, confirm -----------------------------------
    options = page.locator("#slot option").all()
    slot_labels = [o.inner_text().strip() for o in options]
    slot_values = [o.get_attribute("value") for o in options]
    pick = 0
    if pref_time:
        for i, label in enumerate(slot_labels):
            if pref_time in label.lower():
                pick = i
                break
    page.select_option("#slot", slot_values[pick])
    page.fill("#claim_number", claim)
    page.fill("#customer_name", name)
    page.click("#book-submit")
    page.wait_for_selector("#booking-ref, #book-error", timeout=15000)
    if page.locator("#book-error").count():
        return _fail("booking_rejected", _text("#book-error"), store_name=chosen["name"], alternatives=alternatives)
    _shot("scheduler-04-confirmation")

    # --- 5. Read confirmation -----------------------------------------------------------
    return {
        "status": "success",
        "error": None,
        "success": True,
        "booking_ref": _text("#booking-ref"),
        "store_name": _text("#store-name"),
        "address": _text("#store-address"),
        "store_phone": _text("#store-phone"),
        "appointment_time": _text("#appointment-time"),
        "appointment_iso": page.locator("#appointment-time").get_attribute("data-slot"),
        "distance": chosen["distance"],
        "service": _text("#service"),
        "claim_number": _text("#claim-number"),
        "customer_name": _text("#customer-name"),
        "what_to_bring": [li.inner_text().strip() for li in page.locator("#what-to-bring li").all()],
        "other_slots_at_store": [l for i, l in enumerate(slot_labels) if i != pick][:3],
        "alternatives": alternatives,
        "skipped_stores": skipped,
    }


try:
    return _run()
except Exception as e:
    Conversation.log_error(f"book_repair browser flow failed: {type(e).__name__}: {e}")
    return _fail("browser_flow_failed", "The repair scheduler did not respond as expected.", detail=str(e)[:300])
