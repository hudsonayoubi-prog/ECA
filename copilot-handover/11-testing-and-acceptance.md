# 11 · Testing and acceptance

## Automated tests (prototype)

```bash
cd project
npm install                          # react, react-dom, htm, playwright
npx playwright install chromium      # or set CHROMIUM_PATH
npm test                             # builds, then runs all 15 suites; each must print NO ERRORS
```
Each suite loads `tests/index.html` in Chromium, drives the UI with Playwright, prints what it checked, and ends with `NO ERRORS` when no page error was raised. Output files (screenshots, downloaded workbooks) go to `tests/out/`.

| Suite | Covers |
|---|---|
| `eca.js` | Sign-in for each role, duplicate-name handling, leaderboard, review/approve/reject, finalise and distribute (step-up PIN), settings, audit history, sign-in log, store types, mobile layout (no horizontal scroll) |
| `shared.js` | Shared storage with `fakedb.js`: boot without writes, writes after actions, live updates across two pages, no echo loops, persistence after reload, config sync |
| `roll.js` | Month rollover: previous month becomes In review, log entry, scores reset |
| `st.js` | Store location types and counts |
| `milla.js` | Name correction migration (Mill → Milla) across all records |
| `step1.js` | Step 1 state + institution-type pickers, counts, clearing on change, Admin must pick a state |
| `facings.js` | Store contact validation, prefill rules (SM vs Manager), Red Bull facings, share of shelf, saved to visit and location, visibility of phone/email |
| `comps.js` | Multiple competitors incl. a typed-in brand, price/POS/coolers per competitor, derived top competitor, vending (no POS/cooler fields) |
| `tafe.js` | TAFEs per state; migration adds them to saved data without duplicates |
| `wa.js` | WA universities; migration; WA SM sees only WA institutions |
| `logo.js` | Logo upload, resize and save; tiles; editing a 6-letter-code institution |
| `monthly.js` | Monthly summaries per role, inbox items, modal, Excel downloads, SM cannot see the tab |
| `exec.js` | Execution section KPIs, demo-facings migration, monthly summary execution fields, Excel sheets |
| `export.js` | Audit exports per role, inbox notices, All states / One state / Month to date files, workbook sheets |
| `permissions.js` | Visit rules read-only for Managers, editable for Admins; adding a location under a 6-letter institution code (GOTAFE-001) |
| `screenshots.js` | Regenerates `assets/screenshots/` (31 images) |

Excel outputs are additionally validated by opening them with `openpyxl` (no warnings) and converting with LibreOffice (renders charts).

## Acceptance checklist (prototype parity and production build)

Tick each with evidence (screenshot, test output, or Dataverse record).

### Access
- [ ] Only listed people can sign in; unknown names refused; lockout after 5 tries (BR-01)
- [ ] Duplicate names prompt a choice with labels (BR-02)
- [ ] Role/state scoping matches the matrix in BR-03 for every screen and action
- [ ] Step-up required for role change, scoring change, finalise, distribute, finalised-month correction (BR-04)

### Audit
- [ ] Step 1: state (Admin) → type → institution (with counts) → campus → location; changes clear dependants (BR-30)
- [ ] Contact name required for Completed; phone/email format checks; prefill rules by role
- [ ] Ranging Yes/No for every applicable product, prefilled (BR-31)
- [ ] Facings: Red Bull, any number of competitors, add custom brand, price/POS/coolers (stores), live share of shelf (BR-32)
- [ ] Outcomes, notes, photos, issue; review lists problems with links; drafts; leave confirmation (BR-33–36)
- [ ] Submit updates location, notifies Managers, sets approval (BR-37, BR-40)
- [ ] Completed audit can be done in < 2 minutes on a phone (BR-71)

### Rules and reporting
- [ ] Location status and due dates match `locationStatus` for: never visited, visited today, overdue, due in 3 days, paused (BR-20–21)
- [ ] Leaderboard: weights, normalisation, minimum audits, tie-breaks, monthly reset, finalise lock, corrections logged (BR-41–45)
- [ ] Removal request → Lead decision → requester notified (BR-51)
- [ ] Daily summary only for ≥ 2 audits/day (BR-52)
- [ ] Monthly state summary to Managers + Leads; national breakdown to Admins; figures equal the definitions in `07-data-model.md` (BR-53)
- [ ] Audit export on the last calendar day; Admin all/one state, Manager own state; Dashboard with 8 KPIs and 9 charts; Summary; per-state sheets with 61 columns; Chart data (BR-54–55)
- [ ] Progress Execution section and Excel (BR-56)
- [ ] Audit log entries for every change; sign-in log (BR-60)

### Quality
- [ ] No horizontal scroll at 375 px; rail/bottom bar switch at 1024 px; modals become bottom sheets ≤ 640 px (BR-70)
- [ ] Keyboard: every control reachable, visible focus, Escape closes dialogs; screen-reader labels (BR-72)
- [ ] Loading ("Loading shared data…"), empty, permission ("View only"), error ("couldn’t be saved") states shown
- [ ] Two users editing at once lose no data (BR-73)
- [ ] No secrets or real personal data in code or fixtures
- [ ] Every requirement traces to code and evidence (`15-reconstruction-instructions.md` map)
