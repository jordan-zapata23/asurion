# Decagon tool definitions

Create these in **Build > Tools > Create tool** on the Asurion demo team (internal view, Agent Versioning enabled). The three portal tools use **Tool type: Browser action**. The PIN check is a normal coded tool.

Recommended order: create the team secrets first, then the tools, then wire the AOP.

## Team secrets (Settings > Secrets)

| Secret name | Value (default in portals app) | Used by |
|---|---|---|
| `PROTECTCO_ENROLLMENT_USERNAME` | `decagon.svc` | lookup_enrollment |
| `PROTECTCO_ENROLLMENT_PASSWORD` | `Enr0ll-2026!` | lookup_enrollment |
| `PROTECTCO_CLAIMS_USERNAME` | `decagon.svc` | file_claim |
| `PROTECTCO_CLAIMS_PASSWORD` | `Cl@ims-2026!` | file_claim |
| `PROTECTCO_SCHEDULER_USERNAME` | `decagon.svc` | book_repair |
| `PROTECTCO_SCHEDULER_PASSWORD` | `Sch3d-2026!` | book_repair |

Change the passwords in the deployed app's environment variables (`ENROLLMENT_PASS`, `CLAIMS_PASS`, `SCHEDULER_PASS`) and mirror the new values here. Never paste them into the script.

## Shared constant variable on each browser tool

| Variable | Type | Value |
|---|---|---|
| `PORTAL_BASE_URL` | Constant | `https://<your-deploy-host>` (no trailing slash) |

---

## 1. `verify_customer_pin` (coded tool)

**Description for the agent:** Verifies the customer's identity by checking the mobile number and the last 4 digits of their account PIN. Call before any account lookup.

| Input | Type | Description |
|---|---|---|
| `mobile_number` | string | The customer's 10-digit mobile number, any format. |
| `pin_last4` | string | Last 4 digits of the account PIN the customer provided. |

**Returns:** `verified` (bool), `reason`, `message`, `mobile_number` (normalized).

Script: `tools/verify_customer_pin.py`

---

## 2. `lookup_enrollment` (Browser action)

**Description for the agent:** Looks up a subscriber in the Carrier Enrollment Portal by mobile number and returns their protection plan, enrollment status, enrolled device (make, model, IMEI), deductible by loss type, and claims in the last 12 months. Use the returned `device_model` and `device_imei` in later steps.

| Input | Type | Description |
|---|---|---|
| `mobile_number` | string | Verified 10-digit mobile number. |

| Variable | Type | Binding |
|---|---|---|
| `PORTAL_BASE_URL` | Constant | deploy URL |
| `ENROLLMENT_USERNAME` | Secret | `PROTECTCO_ENROLLMENT_USERNAME` |
| `ENROLLMENT_PASSWORD` | Secret | `PROTECTCO_ENROLLMENT_PASSWORD` |

**Returns:**

```json
{
  "status": "success",
  "error": null,
  "found": true,
  "name": "Maria Alvarez",
  "carrier": "Verizon",
  "plan": "Total Mobile Protection",
  "enrollment_status": "Active",
  "is_enrolled": true,
  "device_make": "Apple",
  "device_model": "iPhone 15 Pro",
  "device_imei": "356789104512345",
  "deductibles": { "Cracked Screen": 29.0, "Physical Damage": 99.0, "Liquid Damage": 99.0, "Loss": 249.0, "Theft": 249.0, "Malfunction": 0.0 },
  "cracked_screen_deductible": 29.0,
  "claim_limit_12mo": 3,
  "claims_last_12mo_count": 0,
  "claims_remaining": 3,
  "claims_last_12mo": [],
  "portal_banner": null
}
```

When the number is unknown: `{"status": "error", "found": false, "error": "subscriber_not_found", "message": "No subscriber found ..."}`. The AOP decides what a `claims_remaining` of 0 means; the tool only reports the numbers on the page.

Script: `tools/lookup_enrollment.py`. Record URL for the recorder: `{PORTAL_BASE_URL}/enrollment/login`.

---

## 3. `file_claim` (Browser action)

**Description for the agent:** Files a device protection claim in the Claims Adjudication Console and returns the claim number, adjudication status (Approved or Pending Review), and the deductible due. Only call after the customer has confirmed the device, the loss type, and the deductible.

| Input | Type | Description |
|---|---|---|
| `mobile_number` | string | Verified mobile number. |
| `loss_type` | string | One of: Cracked Screen, Physical Damage, Liquid Damage, Loss, Theft, Malfunction. |
| `incident_date` | string | YYYY-MM-DD. Use today's date if the customer says it just happened. |
| `description` | string | Short description of what happened, in the customer's words. |
| `imei` | string | `device_imei` from lookup_enrollment. |

| Variable | Type | Binding |
|---|---|---|
| `PORTAL_BASE_URL` | Constant | deploy URL |
| `CLAIMS_USERNAME` | Secret | `PROTECTCO_CLAIMS_USERNAME` |
| `CLAIMS_PASSWORD` | Secret | `PROTECTCO_CLAIMS_PASSWORD` |

**Returns:**

```json
{
  "status": "success",
  "error": null,
  "success": true,
  "claim_number": "CLM-2026-0048213",
  "claim_status": "Approved",
  "approved": true,
  "deductible_due": 29.0,
  "deductible_due_display": "$29.00",
  "adjudication_note": "Auto-adjudicated: enrolled, within claim limit, IMEI verified, loss type eligible for in-store repair.",
  "fulfillment": "Walk-in Screen Repair (authorized repair network)"
}
```

Portal rule: Cracked Screen + Active + under claim limit + IMEI matches = **Approved**. Anything else = **Pending Review** with the reason in `adjudication_note`.

Script: `tools/file_claim.py`. Record URL: `{PORTAL_BASE_URL}/claims/login`.

---

## 4. `book_repair` (Browser action)

**Description for the agent:** Finds the nearest authorized repair store with same-day capacity and parts in stock for the device, books the earliest slot, and returns the booking reference, store address, appointment time, and what to bring. Stores without parts are skipped automatically and listed in `skipped_stores`.

| Input | Type | Description |
|---|---|---|
| `zip` | string | Customer's 5-digit ZIP. |
| `device_model` | string | `device_model` from lookup_enrollment, e.g. "iPhone 15 Pro". |
| `repair_type` | string | "Screen Repair" for cracked screens. |
| `claim_number` | string | `claim_number` from file_claim. |
| `customer_name` | string | `name` from lookup_enrollment. |
| `preferred_time` | string, optional | e.g. "3:15 PM". Picks that slot at the chosen store if offered. |
| `exclude_stores` | string, optional | Comma-separated store names the customer declined. |

| Variable | Type | Binding |
|---|---|---|
| `PORTAL_BASE_URL` | Constant | deploy URL |
| `SCHEDULER_USERNAME` | Secret | `PROTECTCO_SCHEDULER_USERNAME` |
| `SCHEDULER_PASSWORD` | Secret | `PROTECTCO_SCHEDULER_PASSWORD` |

**Returns:**

```json
{
  "status": "success",
  "error": null,
  "success": true,
  "booking_ref": "RB-3V5I",
  "store_name": "uBreakiFix by Asurion - The Gulch",
  "address": "601 12th Ave S, Nashville, TN 37203",
  "store_phone": "(615) 555-0207",
  "appointment_time": "Today, Thu, Oct 29, 2026 at 2:30 PM",
  "distance": "1.1 mi",
  "what_to_bring": ["The damaged device, powered on if possible", "A government-issued photo ID ...", "..."],
  "other_slots_at_store": ["Today, ... at 3:15 PM", "Today, ... at 4:45 PM"],
  "alternatives": [{ "name": "Mobile Rescue - Berry Hill", "distance": "3.9 mi", "next_available": "..." }],
  "skipped_stores": [{ "name": "uBreakiFix by Asurion - Midtown", "distance": "0.8 mi", "reason": "no parts in stock" }]
}
```

Script: `tools/book_repair.py`. Record URL: `{PORTAL_BASE_URL}/scheduler/login`.

---

## Conventions (from docs.decagon.ai/build/tools)

- **Inputs arrive as Python variables by name.** Tool code is Python 3.11; the variables you declare on the tool are available as globals with the same names ([Write tool logic](https://docs.decagon.ai/build/tools/tools#write-tool-logic)).
- **Output is the `return` value**, any JSON-serializable type, truncated at 2,000 tokens, 60-second execution limit ([Return output](https://docs.decagon.ai/build/tools/tools#return-output)). `book_repair` prunes its store lists to stay far under the cap.
- **Every response has `status` and `error`.** `error` is `None` on success, a short code on failure, with a human-readable `message`. Failures inside the browser flow are caught, logged with `Conversation.log_error` so they show in audit logs, and returned as `error: "browser_flow_failed"` rather than raising ([Tool Best Practices](https://docs.decagon.ai/build/tools/best-practices)).
- **Secrets are Secret-source variables** with **Hide from context** enabled, so the agent never sees credentials ([Browser Actions](https://docs.decagon.ai/build/tools/browser-actions), [Variables](https://docs.decagon.ai/build/tools/tools#variables)).
- **Chain with Tool Output variables.** On `file_claim`, bind `imei` to Tool Output from `lookup_enrollment`. On `book_repair`, bind `device_model` and `customer_name` to `lookup_enrollment` and `claim_number` to `file_claim`. This keeps the agent from re-typing IMEIs and claim numbers. If your team prefers, leave them as Conversation History and the AOP instructions still tell the agent which value to pass.
- **Use Enum data type** for `loss_type` and `repair_type` with the allowed values listed in the tables above. The scripts still normalize loose values ("screen", "cracked") as a fallback.
- **Judgment stays in the AOP.** The tools return raw facts (claim counts, limits, statuses, skipped stores). The decision to stop at the claim limit or escalate on device mismatch lives in the AOP, as the Browser Actions page recommends.
- Each script logs in fresh, as the harness requires, then uses `id` selectors that exist on every input, button, and result field in the portals. Element lookups poll up to 15 seconds; the portals respond in well under a second.
- `DEBUG_SHOTS = False` at the top of each browser script. Set it to `True` during rehearsal to post screenshots and DOM snapshots into the conversation after each step. Turn it off before the live demo unless you want the visuals in chat. See the demo script for the recommendation.
- The public page describes Browser Actions as "recorded tasks" and the internal guide says the recorder generates Python against a Playwright `page`. If the recorder's generated code on your team wraps the flow differently, keep its wrapper and paste the `_run()` body from these scripts into it.
