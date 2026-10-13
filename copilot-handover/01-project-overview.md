# 01 · Project overview

## Name
**Education Channel Audit Tool (ECA)**. Earlier names: "Student Marketeer Activity Tracking Platform" (first design), "University Store Audit App" (first prototype), "Education Channel Execution Tracker" (the Excel workbooks it replaced).

## Owner and sponsor
Hudson Ayoubi, National Student Marketing Manager, Red Bull Australia, Sydney (hudson.ayoubi@redbull.com). Hudson makes product decisions; Sales leadership consumes the reports.

## Problem
Student marketing activity on campuses was spread across one Excel tracker per university, emails and individual reports. Nobody could see, nationally and in time, which campus stores had been visited, what was ranged, how Red Bull compared with competitors on shelf, or which Student Marketeers were performing.

## Objective
One source of truth that Student Marketeers update from their phones in under two minutes per store, that Managers approve and act on, and that produces monthly, board-ready reporting automatically.

## Users

| Role | Count | What they do in the ECA |
|---|---|---|
| Student Marketeer (SM) | 70 (VIC 8, NSW 27, QLD 16, SA 10, WA 9) | Audit stores and vending machines in their state; see their own scorecard and the leaderboard; request removal of closed stores |
| Manager | 16 (VIC 5, NSW 4, QLD 3, SA 2, WA 2) | Everything in their state: approve audits, add locations and institutions, manage SMs, receive the monthly state summary and audit export |
| Administrator | 16 (national) | Everything nationally: settings, scoring rules, finalise and distribute monthly results, national breakdown and all-state exports |
| Education Channel Lead | Admin flag, 1–2 per state | Approves removal requests for their state; receives daily summaries |
| Leadership ("top dogs") | n/a | Do not use the app; read the monthly Excel Dashboard sheet |

Reporting lines: see `project/config/roster.json` and `07-data-model.md`.

## Scope (in)
- Five states: VIC, NSW, QLD, SA, WA. Tasmania (UTAS) sits under VIC until set up.
- 38 universities and 21 TAFEs (Adelaide University reflects the 2026 University of Adelaide + UniSA merger).
- 215 VIC audit locations from the Excel tracker (QSR stores and vending machines). Other states add locations in the app.
- A six-step audit (visit details and contact → ranging → front facings, competitors, pricing and execution → outcomes → notes, photos and issues → review and submit).
- 14-day visit cycle with status (On Track, Due Soon, Overdue, No Visit Recorded) and reminders.
- Manager approval of audits; monthly National Leaderboard with podium, scorecards and finalise-and-send.
- Removal requests routed to the state's Education Channel Lead.
- Notifications: per-audit alerts, removal requests, daily activity summaries, monthly state summaries, national breakdown, monthly audit exports.
- Progress reporting including execution (Editions, POS, coolers, share of shelf, ranging) and Excel downloads.
- Audit log and sign-in log.

## Out of scope (for now)
- Real email/Teams delivery (prototype logs "emails"; production uses Power Automate).
- Photo storage (prototype counts photos only).
- GPS check-in, offline sync, Power BI semantic model (designed in the first solution design; not built).
- Sales pipeline, sponsorships and competitor-intelligence modules from the original "Activity Tracking Platform" brief (superseded by the ECA focus on store audits).

## Success measures
- Every active location audited at least once per 14-day cycle (coverage ≥ 90%).
- Audit completed in under 2 minutes on a phone.
- Monthly results finalised and distributed by business day 3.
- Leadership reads one Excel Dashboard per month without opening the app.
- Share of shelf and ranging tracked by store, institution, state and nationally.

## History (condensed; full detail in `14-decision-log.md`)

| When | Milestone |
|---|---|
| ≈7 Oct 2026 | Solution design for a Power Platform "Student Marketeer Activity Tracking Platform" |
| 7–8 Oct | Seven university Excel trackers combined; VIC master, progress tabs; v2 then v3 tracker (`docs/excel-history/`) |
| 8 Oct | Clickable "University Store Audit" prototype from v3 data; then national version (5 states, universities + TAFEs, three roles) |
| 9 Oct | Rosters loaded and split by manager; prototype rebuilt as the **ECA** (name sign-in, store types, approvals, leaderboard, snapshots, admin step-up, audit history); store types set to QSR/Vending/Student Bar/Convenience/NKA; shared-storage pilot; Dataverse build pack; first Copilot handover |
| 9 Oct (pm) | WA, NSW, QLD and SA universities; TAFEs for every state; institution logo upload; TAFE tag yellow, University tag navy |
| 9 Oct (pm) | Monthly state summaries and national breakdown in Notifications; Excel downloads; store contact in step 1; Red Bull + competitor front facings; multiple competitors with price, POS and coolers; step 1 filtered by state and institution type; Execution section in Progress |
| 12 Oct | Monthly audit export Excel on the last calendar day, one sheet per state; executive Dashboard sheet with nine native bar charts |
| 13 Oct | This migration package |

## Where things stand
- The live prototype works and stores shared data for anyone signed in to claude.ai with access to the link.
- The national rollout needs the Power Platform build (Student Marketeers may not have claude.ai accounts).
- Open decisions are in `13-known-issues.md`.
