# 15 · Reconstruction instructions

Two paths. **Path 1** rebuilds and maintains the prototype exactly. **Path 2** rebuilds the ECA on Power Platform with behavioural parity.

---

## Path 1 — Rebuild / maintain the prototype

1. Clone the `project/` repository. Run `npm install` (Node ≥ 18) and `npx playwright install chromium` (or set `CHROMIUM_PATH`).
2. `npm run build` → `public/index.html`. `npm test` → all suites print PASS.
3. Make changes only in `src/app.js`, `src/head.html` or `src/data/data.json` (see `CONTRIBUTING.md`). Rebuild and re-test. Add a test for any new behaviour.
4. If data shapes change, add a load-time migration in `App()` so existing browsers and the shared database upgrade.
5. If screens change, run `node tests/screenshots.js` and update `05-component-catalogue.md` line references.
6. Hand `public/index.html` to Hudson to publish to the existing claude.ai artifact (keeps the URL and shared data; capabilities db, user, downloads).

### Requirements → implementation map (prototype)

| Requirement | Functions / files | Tests | Screens |
|---|---|---|---|
| BR-01, 02 sign-in | `Login`, `normName`, `personLabel`, `ecaReducer` login/loginFail | eca, milla | 01, 20 |
| BR-03 scope & permissions | `useDerived` (`can`, `scopeStates`) | eca, monthly, export | all |
| BR-04 step-up | `requireAdmin`, `ElevateSheet` | eca | — |
| BR-10–12 institutions, logos | `Universities`, `InstForm`, `InstBadge`, `shrinkLogo`, `KindChip`, `EXTRA_UNIS` | logo, wa, tafe | 05, 06 |
| BR-13–15 locations, store types | `LocationForm`, `nextId`, `guessStoreType`, `storeTypeOf`, `StoreTypesCard` | st | 07, 08 |
| BR-20–22 cycle & status | `locationStatus`, `useDerived`, `useInbox` reminders | eca | 04, 22 |
| BR-30–37 audit | `Audit`, `blankForm`, `prefill`, `validate`, `withTopComp`, `normCompDetail`, reducer `submitVisit` | step1, facings, comps, shared | 18, 23–29 |
| BR-40–45 approvals & leaderboard | `ReviewQueue`, `decide`, `scoreMonth`, `MEASURES`, `rollMonths`, `FinaliseSheet`, `DistributeSheet` | eca, roll | 03, 30 |
| BR-50–52 notifications | `notify`, `useInbox`, `dailySummaries`, removal `submitRequest`/`decideRequest` | eca | 10, 14 |
| BR-53 monthly summaries | `stateMonthly`, `nationalMonthly`, `monthlyFor`, `MonthlySummaries`, `MonthlyView`, `monthlyWorkbook` | monthly, exec | 11, 12 |
| BR-54–55 audit export & dashboard | `AuditExports`, `auditExportWorkbook`, `exportDashboard`, `XLSX_MINI` | export | 13 |
| BR-56 progress & execution | `Progress`, `ExecSection`, `execStats`, `ExecTrend`, `ShareBar` | exec | 09 |
| BR-60 audit trail | `stamp`, `AuditHistory`, `LoginLog` | eca | 16 |
| BR-70–73 quality, shared data | CSS breakpoints, `Sync` | eca (mobile), shared | 17, 20–31 |

---

## Path 2 — Rebuild on Power Platform

Work in a Dev environment inside one solution (`ECA`, publisher prefix `eca_`). Verify each stage before the next.

### Stage 1 — Dataverse schema and security
1. Create every table, column and choice in `docs/power-platform/ECA_Dataverse_Build_Pack.xlsx` ("Tables & columns", "Choices"). Use the logical names given. Add alternate keys where marked (Location ID, Snapshot Month).
2. Business Units: one per state under the root. Teams per state and role mapped to Entra groups.
3. Security roles per `12-security-and-privacy.md`; column security profile for contact phone/email (SM: create/update, no read).
4. Turn on auditing for all ECA tables.
*Check:* table and column counts match the build pack; a test SM user cannot read another state's locations or any contact phone.

### Stage 2 — Data
1. Fill emails (sheet 3) and Reports To gaps; import sheets 1–13 in order; all Checks OK.
2. Link ECA User to systemuser by email.
*Check:* 102 users, 59 institutions (38 University + 21 TAFE), 215 locations, 103 history visits, 5 competitors.

### Stage 3 — Canvas app (phone layout first)
Screens and parity references:

| Power Apps screen | Prototype component | Screenshot |
|---|---|---|
| scrLeaderboard (SM home) | `Leaderboard`, `MonthBoard`, `Podium`, `ScoreCard` | 03, 30 |
| scrDashboard | `Dashboard` | 02, 19, 21 |
| scrMyVisits | `MyVisits`, `VisitCard` | 04, 22 |
| scrAudit (6 steps in one screen with a step indicator, or 6 screens) | `Audit` | 18, 23–28 |
| scrInstitutions, scrInstitution | `Universities`, `UniDetail`, `InstForm` | 05, 06 |
| scrLocations, scrLocation, scrLocationForm | `LocationList`, `LocationDetail`, `LocationForm`, `RemovalForm` | 07, 08, 29 |
| scrProgress | `Progress`, `ExecSection` | 09 |
| scrNotifications (Inbox, Requests, Daily, Monthly, Exports) | `Notifications` | 10–14 |
| scrPeople | `People`, `PersonForm` | 15 |
| scrSettings | `Settings` and cards | 16 |
Rules: use the design tokens in `04-ui-design-system.md` as named colours/variables; reproduce validation messages verbatim; implement each state (empty, loading, error, permission). Starter formulas: `docs/power-platform/powerfx.txt`.

**Audit step specifics:** step 1 cascading dropdowns (State → Institution type → Institution with active-location counts → Campus → Location); contact fields with `IsMatch` for phone (≥ 8 digits) and email; step 3 competitor gallery from the Competitor table with toggle, "Add competitor" (creates a Competitor row flagged Added From Field), per-competitor facings/price/POS/coolers (POS/coolers hidden for Vending), live share-of-shelf label `RB / (RB + Sum(compFacings))`; submit with `Patch` to Audit Visit then `ForAll(... Patch Visit Competitor)`, then update Location and Location Competitor rows.

### Stage 4 — Flows
Build F1–F10 (`06-technical-architecture.md` Part B). Score calculation (F5 and on demand) must reproduce `scoreMonth` exactly: latest approved audit per location for ranging; sums for TDP/Editions/POS/Coolers; relative or target normalisation capped at 100; weights ÷ total; minimum audits; tie-breaks TDP → ranging → audits → earliest last approval → name.

### Stage 5 — Monthly reports
Excel template (or Office Script) reproducing the export: **Dashboard** (title, period line, 8 KPI tiles with Δ vs previous month, key points, 9 charts as listed in BR-55), **Summary** (16 columns), one sheet per state (61 columns, see `auditExportWorkbook` header list), **Chart data**. State summaries/national breakdown per BR-53. Save to SharePoint, write Monthly Report rows, notify recipients.

### Stage 6 — Acceptance and go-live
Run the checklist in `11-testing-and-acceptance.md` in Test with one user per role per state. Pilot VIC, then roll out. Migrate any pilot data from the claude.ai artifact before retiring it.
