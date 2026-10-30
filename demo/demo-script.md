# Demo script: "Cracked screen to same-day repair" (about 8 minutes)

**Setup before the room joins:** see `rehearsal-checklist.md`. Screen layout: Decagon chat (test conversation) on the left, a browser window on the right with four tabs open: the three portal login pages and `/admin/activity`. If you are using `_shot()`, the right side can instead be the conversation's file panel.

---

## 1. Set the scene (1 min)

Say: "Here's what happens today when a Verizon customer with a cracked screen reaches an Asurion rep."

Click through the three portal tabs. Don't log in yet, just show the login screens.

- "Carrier Enrollment Portal. The rep logs in, searches the number, reads the plan and deductible off the screen."
- "Claims Adjudication Console. Second login. Six-field form. Reads back the claim number."
- "Repair Network Scheduler. Third login. Searches stores, checks which ones actually have the part, books."

Land the point: "Three logins, three screens, eight to twelve minutes of handle time. None of these systems has an API. That's the constraint we're working inside."

## 2. Happy path (3 min)

Switch to the Decagon chat. Type as the customer:

> My screen is shattered, can I get it fixed today?

Agent asks for mobile and PIN. Type:

> 615-555-0101, PIN ends in 4471

While the first browser action runs, say: "Right now Decagon has opened a real browser, logged into the enrollment portal with a service account, searched the number, and is reading the page." If screenshots are on, point at the subscriber detail capture.

Agent confirms the iPhone 15 Pro and asks what happened. Type:

> Dropped it on the sidewalk. Screen is cracked but it still works.

Agent states the $29 deductible and asks for consent. Type:

> Yes, go ahead

Say: "Second browser action. New claim, loss type, incident date, IMEI pulled from the first portal so the customer never has to find it. The console auto-adjudicates because it's a cracked screen, she's enrolled, and she's under her claim limit."

Agent returns the claim number and asks for the ZIP. Type:

> 37203

Say: "Third action. Watch the results table. The nearest store is 0.8 miles away and has no iPhone 15 Pro screens in stock. The agent skipped it and booked the next one that does. A human rep does that scan by eye."

Agent recaps: claim number, $29, The Gulch address, 2:30 PM, what to bring.

Close the section: "About ninety seconds end to end, no API built, and the customer got a specific time and address."

## 3. Edge case: judgment, not just clicking (2 min)

Start a new conversation. Type:

> cracked my screen again, need it fixed

> 615-555-0102, PIN 8820

Agent reads the claim history off the enrollment page, sees two of two claims used in the last twelve months, and explains that instead of filing. It escalates with a summary.

Say: "Same first browser action. Different outcome. The agent read the claim history table, matched it against the plan limit on the same page, and stopped. It didn't file a claim that would've bounced to Pending Review. The escalation summary is what the human rep sees."

If time allows, run the device mismatch persona (615-555-0104, PIN 9034, say "my iPhone screen is cracked"). The enrolled device is a Galaxy S23, so the agent escalates.

## 4. Ops close (2 min)

Switch to the `/admin/activity` tab and refresh.

Say: "This is your side of it. Every action the service account took, timestamped, by portal: login, search, claim filed, appointment booked. Nothing happened off the books."

Switch to the Decagon conversation trace. Open one tool call.

Say: "And here's the same thing from the Decagon side: tool inputs, tool outputs, and the exact values the agent used. Credentials never appear in the script. They sit in team secrets and are injected at run time."

Optionally open Build > Tools > lookup_enrollment and scroll to the variables panel showing the secret bindings.

Close: "What you saw is three Browser Actions in front of three legacy portals, one procedure that knows when to stop, and a full audit trail. The next step is picking the real portal you'd want this on first."

---

## Narration cheat sheet

| Moment | One line to say |
|---|---|
| First tool fires | "Real browser, real login, reading the page the rep reads." |
| Deductible confirmation | "It asks before it spends the customer's money." |
| Claim filed | "IMEI came from portal one. The customer never typed it." |
| Store skipped | "Nearest store had no part. It moved on." |
| Edge case stop | "Reading the table and deciding not to act is the hard part." |
| Audit log | "Every click is attributable to the service account." |

## Screenshots on or off for the live demo?

**Recommendation: on, but only for the first run.** Set `DEBUG_SHOTS = True` on the three browser tools for the happy path, so the subscriber page, confirmation page, and results table appear in the conversation as the agent works. For the edge case, the screenshot links clutter the escalation summary. If you can't flip the flag between runs, keep them off and use the headed browser on a second display instead.
