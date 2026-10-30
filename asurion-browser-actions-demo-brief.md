# Build Brief: Asurion "Cracked Screen to Same-Day Repair" Browser Actions Demo

Hand this file to Claude Code. It describes the mock portals, the Decagon Browser Action tools, the AOP, and the demo script.

## The story (what Asurion sees)

A Verizon customer drops their phone and opens chat: *"My screen is shattered, can I get it fixed today?"*

The Decagon agent, in about 90 seconds:

1. Verifies the customer (phone number + last 4 of account PIN, mocked).
2. **Browser Action #1:** Logs into the legacy **Carrier Enrollment Portal** (no API) and pulls their plan, enrollment status, deductible, and claim history.
3. Files the claim.
4. **Browser Action #2:** Logs into the **Claims Adjudication Console** (no API), opens a new claim, picks the loss type, and enters the device IMEI. It reads back the claim number and the approval status.
5. **Browser Action #3:** Logs into the **Repair Network Scheduler** (no API), finds the nearest repair store with same-day screen-repair capacity and parts for that model, and books a slot.
6. Confirms everything in chat: claim number, $29 deductible, store address, 2:30pm today, and what to bring.

The point to land: **today a human rep alt-tabs across three legacy screens to do this. Decagon does it without Asurion building a single API.**

A split-screen view makes the demo land. Show chat on the left and, on the right, a live panel of the portals being driven: screenshots streamed into the conversation via the `_shot()` helper, or the mock portals open in headed mode on a second monitor.

## Part 1: Build three mock legacy portals

One small web app (Node/Express or Flask), deployed to a public HTTPS URL that Decagon's browser can reach (Render, Fly, Railway, or Vercel). Seeded fake data and no real Asurion systems. Use generic placeholder branding, with no real Asurion or carrier logos.

Make them **look legacy on purpose**: dense tables, gray chrome, tabs, early-2010s enterprise styling. The "this is your real back office" feeling is half the demo.

Hard constraints from the Browser Actions harness:

- **Username/password login form** for each portal (a service account). No SSO, OAuth popups, MFA, or CAPTCHA.
- **Single tab only.** No `target="_blank"`, popups, or modal windows that open new browser contexts. In-page modals are fine.
- **Stable, semantic selectors**: `id`, `name`, `aria-label`, and visible labels on every input/button.
- Server-rendered or fast-hydrating pages. Each full flow should finish in **under 5 seconds**.
- No session reuse is assumed. Every tool run logs in fresh.

### Portal A: Carrier Enrollment Portal (`/enrollment`)

- Login page, then a search page (search by mobile number), then a subscriber detail page.
- Detail page shows: subscriber name, carrier (Verizon / AT&T / T-Mobile), plan name (e.g. "Total Mobile Protection"), enrollment status, enrolled device (make/model/IMEI), deductible table by loss type (cracked screen $29, damage $99, loss/theft $249), and claims in the last 12 months.
- Seed about 10 subscribers, including edge cases: one **not enrolled**, one with **2 claims already this year** (claim limit), and one whose **enrolled device doesn't match** the device they describe.

### Portal B: Claims Adjudication Console (`/claims`)

- Login, then "New Claim", then a multi-step form (subscriber lookup, loss type dropdown, date of incident, description, IMEI), then submit.
- On submit, show a confirmation page with **Claim # (e.g. CLM-2026-0048213)**, status (Approved / Pending Review), and deductible due.
- Rule: cracked screen + enrolled + under claim limit = auto-approved. Otherwise Pending Review.

### Portal C: Repair Network Scheduler (`/scheduler`)

- Login, then search stores by ZIP + device model + repair type, then a results table (store name, address, distance, next available slot, parts in stock Y/N), then pick a slot and enter the claim # and customer name, then book.
- Confirmation page shows a booking reference, store address, time, and "what to bring".
- Seed about 8 stores around one demo ZIP. Make sure some have no parts in stock, so the agent visibly skips them.

### Nice-to-have: "Back office" audit view

A `/admin/activity` page that lists every action the service account took (timestamp, portal, action). Pull it up at the end to show Asurion's ops team that everything the agent did is logged.

## Part 2: Decagon Browser Action tools

Create these in **Build > Tools > Create tool > Tool type: Browser action** (internal view, Agent Versioning team). Record each with the Decagon Browser Actions Recorder extension, then refine the script with Claude Code using the page DOM.

| Tool | Inputs | Returns |
|---|---|---|
| `lookup_enrollment` | `mobile_number` | name, carrier, plan, status, device make/model/IMEI, deductible for each loss type, claims_last_12mo |
| `file_claim` | `mobile_number`, `loss_type`, `incident_date`, `description`, `imei` | claim_number, status, deductible_due |
| `book_repair` | `zip`, `device_model`, `repair_type`, `claim_number`, `customer_name` | booking_ref, store_name, address, appointment_time |

For each tool:

- Store portal credentials as **team secrets** and reference them as tool variables. Never hardcode them.
- Parameterize every recorded hardcoded value (search box, dropdowns, etc.).
- Extract the return values from the confirmation/detail page DOM and return them as structured output.
- During rehearsal, add `_shot("label")` calls after key steps so screenshots post into the conversation. **Decide** whether to keep them for the live demo (good for the visual) or remove them (cleaner chat).

## Part 3: AOP (agent procedure)

"Device Damage – Same-Day Repair":

1. Greet and collect the mobile number. Run mock verification (last 4 of PIN).
2. Call `lookup_enrollment`.
   - Not enrolled: explain options and offer enrollment info. Stop.
   - At claim limit, or device mismatch: explain, then escalate to a human with a summary.
3. Confirm the device and loss type with the customer. State the deductible clearly and get explicit consent.
4. Call `file_claim`. If Pending Review, set expectations and give the claim number. Stop.
5. Ask for ZIP and call `book_repair`. Offer the top slot. If declined, offer the next one.
6. Recap: claim #, deductible, store, time, what to bring (ID, device, passcode removed / Find My turned off).

## Part 4: Demo script (about 8 minutes)

1. **Set the scene (1 min):** Show the three ugly portals. "Here's what your rep does today: three logins, three screens, about 8–12 minutes of handle time."
2. **Happy path (3 min):** Run the chat live. Narrate each Browser Action as it fires, and show screenshots or the headed browser.
3. **Edge case (2 min):** Re-run with the subscriber at the claim limit. The agent reads the claim history off the page, doesn't file, and escalates with a clean summary. This shows judgment, not just clicking.
4. **Ops close (2 min):** Show the audit log in the portal, the Decagon conversation trace with tool inputs/outputs, and that the credentials sit in secrets.

## Alternate scenarios (if Asurion wants a different angle)

- **Home+ / appliance protection:** The agent logs into a legacy technician-dispatch portal to schedule an in-home repair visit.
- **Carrier partner swap:** The same flow, but the agent picks among three carrier-specific portals based on the subscriber's carrier. This shows one agent fronting many partner back offices.
- **Shipping replacement:** Instead of a repair store, the agent opens a fulfillment portal, checks replacement-device inventory, and generates a prepaid return label.

## Before you demo

- Confirm the use case in **#proj-browser-actions** (Browser Actions is open beta, scoped use only), and confirm the demo team is on Agent Versioning.
- Rehearse at least 5 full runs. Watch the per-run latency (target 2–5s per tool).
- Have a recorded backup video in case the demo network misbehaves.
