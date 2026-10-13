# Path 2 · Monthly summaries (BR-53)

`scripts/pp_monthly.py` is a Python port of `monthStats`, `execStats`, `stateMonthly` and `nationalMonthly` in `src/app.js`. It is the reference for the Power Automate summary flows. It is pure: audits, people, locations, institutions and rules go in; the summary comes out. It reuses `pp_scoring.py` for the leaderboard top 3.

## What it produces
- **State summary** (one per state per month): audits, coverage (active locations visited ÷ active locations), net DPs, Editions, POS, coolers, share of shelf, Red Bull ranging at audited locations, competitor POS and coolers seen, issues, pending approvals; a table by institution and one by Student Marketeer; leaderboard top 3 for the state; highlight sentences; recipients = the state's active Managers plus its Education Channel Leads.
- **National breakdown**: the same totals for all states, a table by state, top 3 nationally, highlights, recipients = active Administrators.
- `summary_months(today)` lists the current month (month to date) and the previous five. `report_row(summary)` gives the Monthly Report row (`eca_monthlyreport` columns, no file): report type, month, state, recipients, and Generated On = 1st of the next month 08:00.

## Rules reproduced
Completed audits only; Rejected and Duplicate are excluded (Pending still counts, and is shown separately). Imported history counts here (unlike the leaderboard). Share of shelf uses each location's latest audit in the month that recorded facings. Ranging here counts answered SKUs only (the leaderboard counts unanswered as not ranged). Removed institutions are left out of the institution table and counts.

## Proof
`npm run test:pp` runs the prototype's own JavaScript (`tests/pp/monthly_js.js`, sliced from `src/app.js`) and the Python port on the same synthetic data and requires identical output, field by field: 12 closed months, 6 month-to-date runs, other months, empty data, and sparse data that triggers the "no audits" and "no locations" highlights. A product-list check fails if the app's Red Bull/competitor SKUs change.

## Not here yet
- The **Excel file** (BR-53 download, BR-54 audit export, BR-55 charts). That is the next piece.
- The 1st-of-month schedule, inbox notices and email sending. Those are the flow itself.
- Accented-name tie-breaks may differ from the app (tests use plain names).
