# Decagon CODED tool (not a Browser Action): verify_customer_pin
#
# Mock identity verification for the demo: checks mobile number + last 4 of the
# account PIN against the seeded demo subscribers. In a real deployment this
# would call the carrier's auth service or be replaced by a widget signature /
# OTP flow. Keep this a normal coded tool so it adds no browser latency.
#
# Tool variables: mobile_number (input), pin_last4 (input)

import re

DEMO_PINS = {
    "6155550101": "4471",  # Maria Alvarez (happy path)
    "6155550102": "8820",  # Derek Okafor (claim limit)
    "6155550103": "2210",  # Priya Nair (not enrolled)
    "6155550104": "9034",  # Tom Brenner (device mismatch)
    "6155550105": "1150",
    "6155550106": "7708",
    "6155550107": "3391",
    "6155550108": "6627",
    "6155550109": "5519",  # Renee Castillo (lapsed)
    "6155550110": "0042",
}

mobile = re.sub(r"\D", "", mobile_number or "")
if len(mobile) == 11 and mobile.startswith("1"):
    mobile = mobile[1:]
pin = re.sub(r"\D", "", pin_last4 or "")[-4:]

if len(mobile) != 10:
    return {"verified": False, "reason": "invalid_mobile", "message": "Mobile number must be 10 digits."}
if len(pin) != 4:
    return {"verified": False, "reason": "invalid_pin", "message": "PIN must be the last 4 digits."}
if mobile not in DEMO_PINS:
    return {"verified": False, "reason": "unknown_account", "message": "No account found for that mobile number."}
if DEMO_PINS[mobile] != pin:
    return {"verified": False, "reason": "pin_mismatch", "message": "The PIN does not match our records."}
return {"verified": True, "mobile_number": mobile}
