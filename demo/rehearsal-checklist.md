# Rehearsal and day-of checklist

## One week out

- [ ] Post the use case in #proj-browser-actions and get the go-ahead (Browser Actions is open beta, scoped use).
- [ ] Confirm the demo team has Agent Versioning enabled. If not, ask in #agent-versioning.
- [ ] Deploy the portals (`portals/`) to a public HTTPS host. Record the URL.
- [ ] Create the six team secrets and the four tools per `decagon/tool-definitions.md`.
- [ ] Record each flow once with the Browser Actions Recorder, then replace the body with the matching script in `decagon/tools/`.
- [ ] Create the AOP from `decagon/aop-device-damage-same-day-repair.md`.
- [ ] Run `decagon/smoke_test.py --base https://<deploy>` from your laptop. All scenarios must pass.

## Rehearsals (at least 5 full runs)

For each run, note the per-tool latency from the conversation trace. Target 2 to 5 seconds per tool.

| Run | Date | lookup (s) | file_claim (s) | book_repair (s) | Issues |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

- [ ] Happy path (615-555-0101 / 4471) completes with claim, $29, store, time.
- [ ] Claim-limit path (615-555-0102 / 8820) escalates without filing.
- [ ] Not-enrolled path (615-555-0103 / 2210) stops politely.
- [ ] Device-mismatch path (615-555-0104 / 9034, customer says iPhone) escalates.
- [ ] Wrong PIN path retries once, then offers a human.
- [ ] "Different time" follow-up re-books with `preferred_time`.
- [ ] Record a backup video of one clean happy-path run.

## Known state behaviors to plan around

- **Claims accumulate.** Each rehearsal adds a claim to the subscriber's history in the enrollment portal. Maria's plan allows 3, so two rehearsals on her number are fine, but a third makes her hit the limit. **Reset before the live demo.**
- **Slots are consumed.** Each booking removes that slot. After a reset the 2:30 PM slot at The Gulch is available again.
- **Claim number sequence.** After a reset the next claim is CLM-2026-0048213. Without a reset it keeps counting.
- **Time of day.** Slots are fixed clock times in Central Time and need 30 minutes of lead time. After about 4:15 PM CT, The Gulch rolls to tomorrow's slots and the recap will say "Tomorrow". If you present late in the day, set `DEMO_FREEZE_TIME=1` on the deploy to always show today's slots.
- **Free-tier hosts sleep.** If on Render free tier, open `/healthz` five minutes before presenting. Better: use the Starter plan for demo week.

## 30 minutes before

- [ ] Open `/admin/activity` and click **Reset demo data**. Confirm the activity table is empty.
- [ ] Open `/healthz` and confirm `ok: true`.
- [ ] Run the happy path once in a test conversation, then **reset again** so the live run gets CLM-2026-0048213 and the 2:30 PM slot.
- [ ] Decide screenshots on or off and set `DEBUG_SHOTS` accordingly on all three tools. Save.
- [ ] Arrange windows: chat left, browser tabs right (three login pages + `/admin/activity`).
- [ ] Close Slack and notifications. Have the backup video open in a paused player.

## If something breaks live

- Tool error that names a selector timing out: the deploy is probably asleep or slow. Say "let me give that a second," open `/healthz`, and re-send the customer message.
- Login failure: a secret value drifted from the deploy's environment variable. Fall back to the backup video.
- Agent files a claim on the claim-limit persona: the AOP step 2 wording regressed. Narrate it as "that's the behavior we tune in the procedure," show Pending Review on the confirmation page, and move to the ops close.
