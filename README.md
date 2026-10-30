# Asurion "Cracked Screen to Same-Day Repair" Browser Actions demo

Built from `asurion-browser-actions-demo-brief.md`. Everything below is fictional data and placeholder "ProtectCo" branding. No real Asurion or carrier systems.

## What's here

```
portals/     Express app: three mock legacy portals + audit log (deploy this)
decagon/     Browser Action scripts, coded PIN tool, tool definitions, AOP text, local runner, smoke test
demo/        8-minute demo script and rehearsal checklist
```

| Portal | Path | Flow | Service account |
|---|---|---|---|
| Carrier Enrollment Portal | `/enrollment` | login > search by mobile > subscriber detail | `decagon.svc` / `Enr0ll-2026!` |
| Claims Adjudication Console | `/claims` | login > New Claim > lookup > loss details > confirmation | `decagon.svc` / `Cl@ims-2026!` |
| Repair Network Scheduler | `/scheduler` | login > search ZIP + model + repair type > results > book > confirmation | `decagon.svc` / `Sch3d-2026!` |
| Back office audit | `/admin/activity` | every service-account action, plus a Reset button | none |

The portal gateway at `/` lists the credentials and all seeded subscribers for setup convenience.

## Plan (status)

1. **Mock portals** - done, verified locally with Chromium. Legacy styling, server-rendered, id/name/aria-label on every control, no popups or new tabs, no JS required.
2. **Browser Action scripts** - done, verified with the local runner. `decagon/tools/*.py`. Need to be pasted into Decagon tools after recording once.
3. **AOP** - written, `decagon/aop-device-damage-same-day-repair.md`. Needs to be created in the Decagon UI.
4. **Demo script + checklist** - written, `demo/`.
5. **Deploy** - not done. Needs a Render/Fly/Railway account. Files are ready (`portals/render.yaml`, `portals/Dockerfile`, `portals/fly.toml`).
6. **Decagon setup** - not done. Requires the UI: secrets, four tools, AOP, dummy test conversation. See `decagon/tool-definitions.md`.
7. **#proj-browser-actions confirmation and Agent Versioning check** - not done.

## Run locally

```bash
cd portals
npm install
npm start            # http://localhost:3000
```

Run the tool scripts against it with real Chromium (the venv already exists if you built this on the same machine; otherwise create it):

```bash
cd decagon
python3 -m venv .venv && .venv/bin/pip install playwright && .venv/bin/python -m playwright install chromium

.venv/bin/python smoke_test.py                                   # all scenarios, prints latency
.venv/bin/python run_local.py tools/lookup_enrollment.py --var mobile_number=6155550101
.venv/bin/python run_local.py tools/book_repair.py --headed --slowmo 400 \
  --var zip=37203 --var device_model="iPhone 15 Pro" --var repair_type="Screen Repair" \
  --var claim_number=CLM-2026-0048213 --var customer_name="Maria Alvarez"   # watch it drive the portal
```

Add `--shots` to any run to write the `_shot()` screenshots and DOM captures to `decagon/shots/`.

## Deploy

Render is the least friction. Push this folder to a GitHub repo, then **New > Blueprint** in Render and point it at the repo. `portals/render.yaml` sets `rootDir: portals`, the health check, and prompts for the three password env vars. Use the Starter plan for demo week so the service never sleeps.

Environment variables the app reads:

| Var | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | listen port |
| `ENROLLMENT_USER` / `ENROLLMENT_PASS` | `decagon.svc` / `Enr0ll-2026!` | portal A login |
| `CLAIMS_USER` / `CLAIMS_PASS` | `decagon.svc` / `Cl@ims-2026!` | portal B login |
| `SCHEDULER_USER` / `SCHEDULER_PASS` | `decagon.svc` / `Sch3d-2026!` | portal C login |
| `COOKIE_SECRET` | demo value | signs session cookies |
| `DEMO_TZ` | `America/Chicago` | timezone for slots and timestamps |
| `DEMO_FREEZE_TIME` | unset | `1` = always show today's slots regardless of clock |

After deploying, run `decagon/smoke_test.py --base https://<host>` once. Then set `PORTAL_BASE_URL` on the Decagon tools to that host.

State is in memory. A restart or a click on **Reset demo data** returns everything to seed: next claim number CLM-2026-0048213, all slots open, empty audit log.

## Seeded scenarios

| Mobile | PIN | Name | Scenario |
|---|---|---|---|
| 615-555-0101 | 4471 | Maria Alvarez | Happy path. Verizon TMP, iPhone 15 Pro, 0 claims, limit 3. |
| 615-555-0102 | 8820 | Derek Okafor | At claim limit (2 of 2). Agent must not file. |
| 615-555-0103 | 2210 | Priya Nair | Not enrolled. |
| 615-555-0104 | 9034 | Tom Brenner | Enrolled device is a Galaxy S23. Customer will say iPhone. |
| 615-555-0109 | 5519 | Renee Castillo | Lapsed for non-payment. |
| 615-555-0105 to 0110 | see `/` | others | AT&T and T-Mobile subscribers for variety. |

Demo ZIP **37203**. Eight stores seeded. Four of them have no iPhone 15 Pro screen parts, including the closest one, so the agent visibly skips it and books **uBreakiFix by Asurion - The Gulch** at **2:30 PM**.

## Portal rules the agent's judgment depends on

- Claims console: Cracked Screen + Active + under limit + IMEI matches = Approved. Otherwise Pending Review with the reason shown on the confirmation page.
- Scheduler: results are distance-sorted; only stores with parts for that model can be selected; a booking consumes the slot; slots need 30 minutes of lead time and roll to tomorrow once today's are gone.
- Filing a claim adds it to the enrollment portal's history, so repeated rehearsals on one number eventually hit the limit. Reset between rehearsals and before the live run.

## What the docs confirm, and what's still assumed

Confirmed from the public docs ([Browser Actions](https://docs.decagon.ai/build/tools/browser-actions), [Tools](https://docs.decagon.ai/build/tools/tools), [Tool Best Practices](https://docs.decagon.ai/build/tools/best-practices)):

- Tool code is Python 3.11. Declared variables arrive as Python globals by name. The `return` value is the tool output, capped at 2,000 tokens, with a 60-second execution limit. The scripts follow this.
- Credentials go in Secret-source tool variables, never in messages or docs. Each run is a fresh browser session that must authenticate. Single tab only, no popups, no file uploads. The portals and scripts were built to these limits.
- Judgment and branching belong in the AOP, not the tool. The tools return raw facts; the AOP decides.
- Returns should carry `status` and `error` (None on success) and log failures with `Conversation.log_error`. The scripts do this and the smoke test checks the error paths.

Still assumed (confirm when you record the first flow):

- The harness exposes a Playwright sync `page`, per the internal guide. The scripts use only `goto`, `fill`, `click`, `select_option`, `locator`, `wait_for_selector`, `get_attribute`, `inner_text`, and `screenshot`.
- `lib.DecagonRequest` and `Conversation.write_message` are available for `_shot()`, per the internal guide.
- If the recorder's generated code wraps the flow differently, keep its wrapper and paste the `_run()` body from each script inside it.

## References

- Public docs: https://docs.decagon.ai/build/tools/browser-actions
- Internal guide: https://docs-internal.decagon.ai/agent-building/usage-guides/browser-actions
- Slack: #proj-browser-actions (use-case approval, debugging), #agent-versioning (team enablement)
- Example dummy AOP for driving a browser tool from a test conversation: linked from the guide's Testing section
