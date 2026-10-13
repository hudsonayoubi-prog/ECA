# 03 · User journeys

Screenshots referenced are in `project/assets/screenshots/`. Test names refer to `project/tests/`.

## J1 · Sign in (everyone)
1. Open the ECA → **Sign in** (01, 20). Enter first and last name → Continue.
2. Unknown name → error; 5 failures → 60-second lockout. Deactivated → "access is switched off".
3. Two active people with that name → pick your profile (shows state, reporting line or label).
4. Landing page: SMs go to **National Leaderboard**; Managers and Admins to **Dashboard**.
5. Header shows the sync chip (**Live · shared** green, or **This browser only** yellow → tap for help, 17), role chip, notifications bell.
*Tests:* `eca.js`, `milla.js`.

## J2 · Student Marketeer completes an audit (phone, < 2 minutes)
1. Tap **Audit** in the bottom bar (or **Start Audit** on a location card).
2. **Step 1 Visit details** (23): state is fixed; choose Universities or TAFEs; pick the institution (shows active location counts); optional campus; pick the location (stores first, vending marked `[Vending]`). Date/time defaults to now, staff to me, status Completed. Enter the **store contact** name (required), role, phone, email.
3. **Step 2 Ranging** (24): Yes/No for each product; answers start from the last audit ("Answers start from the last audit…").
4. **Step 3 Pricing & execution** (25): Red Bull front facings; tick competitors in store (or **Add competitor**); for each, front facings, price, POS pieces, coolers; watch Red Bull share of shelf update; Red Bull price, POS present, cooler present, Bullring/Bull's Eye, channel, classification (vending: machine fields).
5. **Step 4 Outcomes** (26): DPs added/lost, Editions (+ flavours), POS placed (+ type), coolers installed/removed.
6. **Step 5 Notes & follow-up** (27): notes, next step, follow-up date, up to 6 photos, flag issue.
7. **Step 6 Review & submit** (28): fix anything listed; **Submit Completed Audit** → toast "Audit submitted for approval. Next visit due …" and the location page opens (29).
8. Managers of the state get an "X completed an audit" notification. The audit shows *Awaiting approval* on the SM's scorecard.
Alternative: status Scheduled/Cancelled skips steps 2–4. **Save as Draft** any time.
*Tests:* `facings.js`, `comps.js`, `step1.js`, `shared.js`.

## J3 · Manager reviews and approves audits
1. **National Leaderboard → Review activity** lists pending audits in the Manager's state (not their own), oldest first.
2. Open an audit (drill sheet) → **Approve**, **Reject** (reason), or **Mark duplicate** (choose the original). Bulk approve available.
3. Rejected/duplicate → the SM is notified "Audit not counted". Approved audits count towards the month's scores immediately.
*Tests:* `eca.js`.

## J4 · Manager manages the state
- **Dashboard** (19): active locations, visits required/completed, completion %, overdue, due soon, no visit, net DPs; charts; overdue priorities; recent audits.
- **Universities & TAFEs** (05, 06): add/edit an institution (type, code, name, short name, campuses, **logo**); open one to see Overview, Locations, Visits, People and Performance tabs.
- **Audit Locations** (07, 08): filter/search; add a location (ID auto-generated, store type, campus or new campus, cycle); pause, remove or delete (if no history).
- **People** (15): add SMs/Managers in own state, set *Reports to*, deactivate/reactivate.
- **Progress** (09): filters; Execution section; **Download Excel** / Copy CSV.
*Tests:* `eca.js`, `logo.js`, `exec.js`.

## J5 · Student Marketeer requests removal of a closed store
1. Location page → **Request removal** → reason (closed permanently, no longer stocks Red Bull, duplicate, moved/renamed, not accessible, other) + comments.
2. The state's Education Channel Lead gets a request (Notifications → Requests) → **Approve and remove** or **Reject** with an optional note. The requester is notified.

## J6 · Month end (automatic + Administrator)
1. **Last calendar day 18:00:** "Audit export ready" lands in Admin and Manager inboxes → **Notifications → Audit exports** (13) → **All states** / **One state…** (Admin) or **Download** (Manager). Excel opens on the **Dashboard** sheet.
2. **1st of next month:** old month becomes *In review*; scores restart at zero. "Monthly summary: VIC, September 2026" (Managers/Leads) and "National breakdown: September 2026" (Admins) land in the inbox → open (12) → **Download Excel**.
3. **By business day 3:** Administrator opens **National Leaderboard → Results**, reviews pending audits, **Finalise** (step-up PIN) then **Send results** (choose groups, method, message; step-up). Recipients get "ECA monthly results · September 2026".
*Tests:* `roll.js`, `monthly.js`, `export.js`, `eca.js`.

## J7 · Administrator configures the system
- **Settings** (16): signed-in user; admin tools lock/unlock; States and Education Channel Leads; Visit rules and notifications (cycle, due-soon days, reminder lead days, daily summary time, approval mode); **Store location types**; **Scoring rules** (weights total 100, normalisation, targets, minimum audits — step-up); Results distribution defaults; Reference values; Demo data removal; **Audit history** (filter by category); **Sign-in log**.
- **Admin PIN** change (prototype). Production: not applicable (Entra ID).

## J8 · Leadership reads the monthly report (no app access)
1. An Administrator downloads the all-states audit export (J6.1) and shares it (email/Teams/SharePoint).
2. The workbook opens on **Dashboard**: title and period, 8 KPI tiles with ▲/▼ vs last month, key points, 9 bar charts. Charts are native Excel charts: copy into PowerPoint.
3. Detail is on Summary (by state) and per-state audit sheets; chart figures on Chart data.

## J9 · Shared storage not connecting (support)
1. Header chip shows **This browser only** → tap → help sheet (17) explains cause: opened outside claude.ai, permission not granted, or signed out; shows diagnostics (in claude.ai, framed, permission state).
2. Fix: open the claude.ai link in Chrome/Edge while signed in, allow the page to use its data, reload. Chip turns **Live · shared**.
*Tests:* `shared.js` (fake database), `help` behaviour covered in `eca.js` flows.
