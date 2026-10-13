# 05 · Component catalogue

All UI lives in `project/src/app.js` (line numbers below are for the v30 file in this package). Markup is **htm** tagged templates (`html\`…\``) rendered by React 18 through the `h()` adapter (lines 1–20), which accepts plain HTML attribute names and inline style strings. Shared context: `useApp()` returns `{ s, d, D }` — `s` the state, `d` dispatch, `D` derived data and permissions from `useDerived`.

Template for each entry: **Purpose · Source · Inputs/outputs · State and actions · Dependencies · Events · Responsive · Accessibility · Empty/loading/error states · Data · Tests · Known limits · Screenshot.**

---

## Application shell

### `App` (2629–2674)
- **Purpose:** root. Loads saved state (`DataService.load`) and runs migrations (roster revision, name fixes, ECA revisions 1–3, new institutions from `EXTRA_UNIS`, demo facings), then `rollMonths`. Starts `Sync`, diffs state to the shared store on every change, saves to localStorage, auto-clears toasts (3.2 s).
- **State:** `useReducer(reducer)` where `reducer` delegates ECA actions to `ecaReducer`. Provides `Ctx` with `{ s, d, D }`.
- **Routing:** `s.route.page` ∈ dashboard, leaderboard, visits, universities, uni, locations, loc, audit, progress, notifications, people, settings. Not signed in → `Login`.
- **Tests:** every suite.

### `Shell` (794–831), `NotifPanel` (840–847), `Modal` (848–869)
- **Purpose:** frame around every page. Desktop rail (`NAV` order: Dashboard, National Leaderboard, My Visits, Universities & TAFEs, Audit Locations, Progress, Notifications, People, Settings) with yellow **Start Audit**; mobile bottom bar (Home, Visits, Audit, Leaders, More); top bar with page title, `SyncChip`, role chip, bell with unread count (`useInbox`), notifications dropdown (`NotifPanel`).
- **Modal router:** `s.modal.kind` ∈ visit, location, removal, inst, person, summary, monthly, elevate, finalise, distribute, drill, more, syncHelp. Escape closes. Bottom sheet ≤ 640 px.
- **A11y:** `aria-current="page"` on nav, labelled icon buttons, `role="dialog" aria-modal`.
- **Screenshots:** 02, 31.

### `Login` (2167–2200) and `ElevateSheet` (2201–2212)
- **Purpose:** name sign-in (BR-01, BR-02); admin step-up PIN dialog (BR-04).
- **Inputs:** `#li-f`, `#li-l` first/last name; `#el-pin`.
- **Actions:** `login`, `loginFail`, `elevate`, then queued actions (`m.then`).
- **States:** field errors, not-on-list, deactivated, lockout (5 tries / 60 s), choose-profile list, "Loading shared data…" disabled button while shared data loads; PIN wrong / locked after 3.
- **Limits:** name-only identity and a shared PIN are prototype stand-ins for Entra ID. The PIN field hint displays the default PIN (see `13-known-issues.md`).
- **Screenshots:** 01, 20. **Tests:** `eca.js`, `milla.js`.

## Pages

### `Dashboard` (893–941)
KPIs (active locations, visits required/completed, completion, overdue, due soon, no visit, net DPs) for the user's scope and the filter bar (`Filters`, 875–886); charts `ClusterBars` (required vs completed), `StackBars` (status mix), overdue priorities list, recently completed audits. Empty state when the state has no institutions. Screens 02, 19, 21.

### `Leaderboard` (2408–2421) and parts
- Tabs: **This month** for everyone; Managers and Admins also get Year-round, Review activity and Results. **This month** (`MonthBoard` 2241–2272: month picker, Ranked/Everyone, live/provisional banner, `Podium` 2213–2219, `ScoreCard` 2220–2229 for SMs, `BoardTable` 2230–2240, `ScoringRules`), **Review activity** (`ReviewQueue` 2294–2317: pending audits, approve/reject/duplicate, **Approve selected**; `DrillSheet` 2281–2293), **Year-round** (`YearRound` 2325–2363; staff only), **Results** (Admin, `ResultsAdmin` 2364–2375 → `FinaliseSheet` 2376–2384, `DistributeSheet` 2385–2407).
- Data: `scoreMonth` (1978–2012), `boardFor`, `snapOf`, `monthStatus`, `knownMonths`, `reviewQueue`.
- Screens 03, 30. Tests `eca.js`, `roll.js`.

### `MyVisits` (956–989) and `VisitCard` (943–955)
Tabs **To visit** and **My submissions (n)**. Every active location in scope, most urgent first; quick chips (All, Today, This Week, Overdue, Due Soon, Completed), state/institution/campus filters, search; visit cards with status top border, due text, Start Audit. Screens 04, 22.

### `Universities` (991–1010), `InstForm` (1011–1034), `UniDetail` (1035–1054), `UniOverview` (1055–1067), `Performance` (742–759), `VisitHistory`
- Tiles per state (filters: state, type); tile = `InstBadge` (logo or code) + name + `KindChip` (navy University / yellow TAFE) + Active/QSR/Vending + completion bar + overdue/no-visit chips.
- `InstForm`: type, state (Admin), name, code (2–6 capitals, unique, locked after create), short name, campuses (comma list), **logo upload** (`shrinkLogo` → ≤160 px WebP/PNG data URL; remove).
- Detail tabs: Overview, Locations, Visits, People, Performance; Edit / Remove (Manager/Admin) or Request removal (SM).
- Screens 05, 06. Tests `logo.js`, `tafe.js`, `wa.js`.

### `Locations` → `LocationList` (1082–1104), `LocationForm` (1111–1156), `RemovalForm` (1157–1169), `LocationDetail` (1170–1213)
- List with filters (state, institution, campus, type, store type incl. "To confirm", search), status chips, actions.
- Form: institution, store location type (drives QSR/Vending), name, auto ID (`nextId`, editable), campus or add campus, address, landmark, building, level, postcode, visit cycle.
- Detail: KPIs (status, last visit, next due, cycle); Location details incl. **Store contact** (name, role for all; phone/email for Managers/Admins; "Not recorded yet" otherwise); Product ranging grid; **Execution** (Red Bull front facings, competitors with facings/price/POS/coolers, share of shelf with date, POS/cooler present, price, Bullring); Vending details; latest note; visit history timeline; Start Audit; Request removal.
- Screens 07, 08, 29. Tests `st.js`, `facings.js`, `comps.js`.

### `Audit` (576–723) with `blankForm` (533–541), `prefill` (542–549), `validate` (550–575), helpers (518–531)
- **Purpose:** six-step audit (BR-30…BR-37). `STEPS` = Visit details, Ranging, Pricing & execution, Outcomes, Notes & follow-up, Review & submit.
- **Local state:** form `f`, `step`, `dirty`, `confirmLeave`, `tried`, `newComp` (add-competitor text), `pState`/`pKind` (step 1 state and institution-type pickers).
- **Form fields:** see `07-data-model.md` (AuditForm). Competitors: `f.compFacings` `{brand: facings}` + `f.compDetail` `{brand: {price, pos, coolers}}`.
- **Derived:** `shelfShare`, `compTotal`, `compDetailText`, `withTopComp` on submit, `normCompDetail` on save.
- **Events:** state/type change clears institution/campus/location; location change prefills from the location; stepper nav jumps; Next skips steps 2–4 for non-Completed; Save as Draft; Cancel with inline confirm; Submit (finalised month → step-up + correction reason).
- **Validation messages** list on step 6 with links; field errors show after first submit attempt or on step 6.
- **Responsive:** sticky footer above the bottom bar; one-column forms on phones.
- Screens 18, 23–28. Tests `facings.js`, `comps.js`, `step1.js`, `shared.js`.

### `VisitView` (724–741)
Modal for one visit: status/approval/type/date chips, issue and rejection banners, staff, DPs, Editions, POS, coolers, **Red Bull facings, competitors (detail lines), share of shelf, spoke to**, follow-up, photos count, notes, next step; Open location / Edit (if allowed).

### `Notifications` (1215–1248)
- Tabs: **Inbox** (`useInbox` 775–793 merges stored notifications, daily summaries, visit reminders, monthly summaries, audit-export notices; `InboxRow`; Mark all read), **Requests** (removal requests with decide controls for the Lead), **Daily summaries** (`SummaryView` 1249–1260), **Monthly summaries** (Managers/Admins: `MonthlySummaries` 1502–1514, `MonthlyCard` 1491–1501, `MonthlyView` 1515–1539 with KPIs, share-of-shelf bar, highlights, leaderboard top 3, tables, **Download Excel**), **Audit exports** (Managers/Admins: `AuditExports` 1788–1802 — 12-month table, per-state counts, Ready/Generates status, All states / One state… / Month to date), **Email log**.
- Screens 10–14. Tests `monthly.js`, `export.js`.

### `People` (1852–1857), `PeopleTable` (1804–1823), `PersonForm` (1824–1851)
Filters (state, role, status, search); rows with role chip, Education Channel Lead marker, reports-to, audits count; Add/Edit/Deactivate. Form: name, role, state, reports to (Managers in state), same-name handling with label, aliases, status; role changes made by an Administrator need step-up. Screen 15.

### `Progress` (1859–1912) with `ExecSection` (1613–1644), `ExecTrend` (1585–1604), `ShareBar` (1606–1612)
Filters; KPIs; **Execution** (5 KPI tiles with period deltas, running-totals line chart, share-of-shelf bar + competitor table + competitor POS/coolers, breakdown table); by state / by institution tables and charts; monthly completion trend (`MonthTrend`); SM reporting table; **Download Excel** (Summary, By state, By institution, Execution, Student Marketeers, Locations) and **Copy CSV** (fallback textarea if clipboard blocked). Screen 09. Test `exec.js`.

### `Settings` (1914–1944)
Signed in; `AdminAccess` (lock/unlock); States and Education Channel Leads; Visit rules and notifications (editable by Administrators only, read-only for others); `StoreTypesCard`; `ScoringCard` (weights must total 100; step-up); `ResultsSettingsCard`; Reference values; Demo data (remove demo leaderboard activity); `AuditHistory` (category filter); `LoginLog`. Admin PIN change. Screen 16.

## Infrastructure components
- **`Sync`** (2518–2600), **`SyncChip`** (2617–2627), **`SyncHelp`** (2601–2616): shared storage (see `06-technical-architecture.md`). Screen 17.
- **`XLSX_MINI`** (1262–1372): dependency-free .xlsx writer — inline strings, 12 cell styles, frozen headers, autofilter, raw dashboard sheets (merges, row heights, hidden gridlines) and **native bar charts** (DrawingML `c:barChart`, cached values). `boldRow`, `offerDownload` (downloads capability, falls back to a browser download), `fileSafe`, `pct0`.
- **Charts in the page** (464–516): `ClusterBars`, `StackBars`, `MonthTrend`, plus `ExecTrend`, `ShareBar`. Hand-drawn SVG; values printed; `<title>` tooltips.
- **Small components** (432–463): `Icon` (inline SVG paths in `P`), `StatusChip`, `TypeChip`, `Seg`, `Select`, `Text`, `Search`, `Kpi`, `Empty`, `Stepper`; plus `InstBadge`, `KindChip`, `LocStateChip`, `RoleChip`, `StatePick`, `ApprovalChip`, `Medal`, `BoardStatus`.

---

## Full index of functions and constants in `src/app.js`

| Section | Name | Lines |
|---|---|---|
| Preamble (htm adapter) | `ATTR` | 4–4 |
| Preamble (htm adapter) | `camel` | 5–5 |
| Preamble (htm adapter) | `styleObj` | 6–6 |
| Preamble (htm adapter) | `h` | 7–19 |
| Preamble (htm adapter) | `html` | 20–21 |
| CONFIG / REFERENCE VALUES | `DEFAULT_REF` | 23–49 |
| CONFIG / REFERENCE VALUES | `ROLE_LABEL` | 50–50 |
| CONFIG / REFERENCE VALUES | `DEFAULT_STATES` | 51–55 |
| CONFIG / REFERENCE VALUES | `ADMINS` | 56–56 |
| CONFIG / REFERENCE VALUES | `MANAGERS` | 57–58 |
| CONFIG / REFERENCE VALUES | `SM_ROSTERS` | 59–67 |
| CONFIG / REFERENCE VALUES | `EXTRA_UNIS` | 68–131 |
| CONFIG / REFERENCE VALUES | `LEADS` | 132–132 |
| CONFIG / REFERENCE VALUES | `STATUS` | 133–139 |
| CONFIG / REFERENCE VALUES | `STATUS_KEYS` | 140–140 |
| CONFIG / REFERENCE VALUES | `SEED` | 141–141 |
| CONFIG / REFERENCE VALUES | `STORE_KEY` | 142–142 |
| CONFIG / REFERENCE VALUES | `NAME_FIXES` | 143–143 |
| CONFIG / REFERENCE VALUES | `ROSTER_REV` | 144–145 |
| DATE + STATUS LOGIC | `DAY` | 147–147 |
| DATE + STATUS LOGIC | `pad` | 148–148 |
| DATE + STATUS LOGIC | `isoOf` | 149–149 |
| DATE + STATUS LOGIC | `todayISO` | 150–150 |
| DATE + STATUS LOGIC | `parseISO` | 151–151 |
| DATE + STATUS LOGIC | `addDays` | 152–152 |
| DATE + STATUS LOGIC | `diffDays` | 153–153 |
| DATE + STATUS LOGIC | `fmtDate` | 154–154 |
| DATE + STATUS LOGIC | `fmtShort` | 155–155 |
| DATE + STATUS LOGIC | `money` | 156–156 |
| DATE + STATUS LOGIC | `signed` | 157–159 |
| DATE + STATUS LOGIC | `locationStatus` | 160–173 |
| DATE + STATUS LOGIC | `rangeStart` | 174–178 |
| DATE + STATUS LOGIC | `RANGES` | 179–180 |
| DATA ACCESS | `DataService` | 182–186 |
| DATA ACCESS | `seedPeople` | 187–196 |
| DATA ACCESS | `seedState` | 197–210 |
| STATE | `leadsFor` | 212–212 |
| STATE | `managersFor` | 213–213 |
| STATE | `instState` | 214–214 |
| STATE | `notify` | 215–215 |
| STATE | `reducer` | 216–318 |
| STATE | `Ctx` | 319–319 |
| STATE | `useApp` | 320–321 |
| DERIVED DATA + PERMISSIONS | `useDerived` | 323–357 |
| DERIVED DATA + PERMISSIONS | `filterLocs` | 358–368 |
| DERIVED DATA + PERMISSIONS | `summarise` | 369–384 |
| DERIVED DATA + PERMISSIONS | `dailySummaries` | 385–411 |
| ICONS | `P` | 413–429 |
| ICONS | `Icon` | 430–431 |
| SMALL COMPONENTS | `StatusChip` | 433–433 |
| SMALL COMPONENTS | `TypeChip` | 434–434 |
| SMALL COMPONENTS | `storeTypeOpts` | 435–435 |
| SMALL COMPONENTS | `ActiveChip` | 436–436 |
| SMALL COMPONENTS | `dueText` | 437–443 |
| SMALL COMPONENTS | `Seg` | 444–447 |
| SMALL COMPONENTS | `Select` | 448–451 |
| SMALL COMPONENTS | `Text` | 452–455 |
| SMALL COMPONENTS | `Search` | 456–456 |
| SMALL COMPONENTS | `Kpi` | 457–457 |
| SMALL COMPONENTS | `Empty` | 458–458 |
| SMALL COMPONENTS | `Stepper` | 459–463 |
| CHARTS | `ClusterBars` | 465–478 |
| CHARTS | `STATUS_FILL` | 479–479 |
| CHARTS | `StackBars` | 480–491 |
| CHARTS | `MonthTrend` | 492–505 |
| CHARTS | `monthsSeries` | 506–516 |
| AUDIT FORM | `facingComps` | 518–518 |
| AUDIT FORM | `compDetailText` | 519–520 |
| AUDIT FORM | `compSum` | 521–522 |
| AUDIT FORM | `withTopComp` | 523–524 |
| AUDIT FORM | `normCompDetail` | 525–526 |
| AUDIT FORM | `compTotal` | 527–527 |
| AUDIT FORM | `shelfShare` | 528–528 |
| AUDIT FORM | `okPhone` | 529–529 |
| AUDIT FORM | `okEmail` | 530–530 |
| AUDIT FORM | `STEPS` | 531–531 |
| AUDIT FORM | `nowLocal` | 532–532 |
| AUDIT FORM | `blankForm` | 533–541 |
| AUDIT FORM | `prefill` | 542–549 |
| AUDIT FORM | `validate` | 550–575 |
| AUDIT FORM | `Audit` | 576–723 |
| AUDIT FORM | `VisitView` | 724–741 |
| AUDIT FORM | `Performance` | 742–759 |
| AUDIT FORM | `InstBadge` | 760–762 |
| AUDIT FORM | `shrinkLogo` | 763–765 |
| AUDIT FORM | `KindChip` | 766–766 |
| AUDIT FORM | `LocStateChip` | 767–767 |
| AUDIT FORM | `RoleChip` | 768–768 |
| AUDIT FORM | `StatePick` | 769–772 |
| SHELL | `NAV` | 774–774 |
| SHELL | `useInbox` | 775–793 |
| SHELL | `Shell` | 794–831 |
| SHELL | `KIND_ICON` | 832–832 |
| SHELL | `InboxRow` | 833–839 |
| SHELL | `NotifPanel` | 840–847 |
| SHELL | `Modal` | 848–869 |
| FILTERS | `useFilters` | 871–874 |
| FILTERS | `Filters` | 875–886 |
| FILTERS | `instRows` | 887–888 |
| FILTERS | `stateRows` | 889–889 |
| FILTERS | `statusRow` | 890–891 |
| DASHBOARD | `Dashboard` | 893–941 |
| MY VISITS | `VisitCard` | 943–955 |
| MY VISITS | `MyVisits` | 956–989 |
| UNIVERSITIES & TAFEs | `Universities` | 991–1010 |
| UNIVERSITIES & TAFEs | `InstForm` | 1011–1034 |
| UNIVERSITIES & TAFEs | `UniDetail` | 1035–1054 |
| UNIVERSITIES & TAFEs | `UniOverview` | 1055–1067 |
| UNIVERSITIES & TAFEs | `VisitHistory` | 1068–1078 |
| UNIVERSITIES & TAFEs | `VisitChip` | 1079–1080 |
| LOCATIONS | `LocationList` | 1082–1104 |
| LOCATIONS | `Locations` | 1105–1105 |
| LOCATIONS | `nextId` | 1106–1110 |
| LOCATIONS | `LocationForm` | 1111–1156 |
| LOCATIONS | `RemovalForm` | 1157–1169 |
| LOCATIONS | `LocationDetail` | 1170–1213 |
| NOTIFICATION CENTRE | `Notifications` | 1215–1248 |
| NOTIFICATION CENTRE | `SummaryView` | 1249–1260 |
| EXCEL EXPORT | `XLSX_MINI` | 1262–1372 |
| EXCEL EXPORT | `boldRow` | 1373–1374 |
| EXCEL EXPORT | `offerDownload` | 1375–1386 |
| EXCEL EXPORT | `pct0` | 1387–1387 |
| EXCEL EXPORT | `fileSafe` | 1388–1389 |
| MONTHLY SUMMARIES | `monthStats` | 1392–1406 |
| MONTHLY SUMMARIES | `monthRecipients` | 1407–1407 |
| MONTHLY SUMMARIES | `adminNames` | 1408–1408 |
| MONTHLY SUMMARIES | `stateMonthly` | 1409–1433 |
| MONTHLY SUMMARIES | `nationalMonthly` | 1434–1451 |
| MONTHLY SUMMARIES | `summaryMonths` | 1452–1452 |
| MONTHLY SUMMARIES | `summaryTs` | 1453–1453 |
| MONTHLY SUMMARIES | `monthlyFor` | 1454–1462 |
| MONTHLY SUMMARIES | `monthlyWorkbook` | 1463–1488 |
| MONTHLY SUMMARIES | `downloadMonthly` | 1489–1490 |
| MONTHLY SUMMARIES | `MonthlyCard` | 1491–1501 |
| MONTHLY SUMMARIES | `MonthlySummaries` | 1502–1514 |
| MONTHLY SUMMARIES | `MonthlyView` | 1515–1539 |
| EXECUTION METRICS | `rbRangePct` | 1542–1547 |
| EXECUTION METRICS | `compRanged` | 1548–1548 |
| EXECUTION METRICS | `avg` | 1549–1553 |
| EXECUTION METRICS | `execStats` | 1554–1574 |
| EXECUTION METRICS | `pctOr` | 1575–1575 |
| EXECUTION METRICS | `deltaTxt` | 1576–1578 |
| EXECUTION METRICS | `dailyCumulative` | 1579–1583 |
| EXECUTION METRICS | `EXEC_SERIES` | 1584–1584 |
| EXECUTION METRICS | `ExecTrend` | 1585–1604 |
| EXECUTION METRICS | `BRAND_FILL` | 1605–1605 |
| EXECUTION METRICS | `ShareBar` | 1606–1612 |
| EXECUTION METRICS | `ExecSection` | 1613–1644 |
| EXECUTION METRICS | `demoFacings` | 1645–1654 |
| MONTHLY AUDIT EXPORT | `monthLastDay` | 1656–1657 |
| MONTHLY AUDIT EXPORT | `exportStates` | 1658–1659 |
| MONTHLY AUDIT EXPORT | `exportMonths` | 1660–1664 |
| MONTHLY AUDIT EXPORT | `auditsFor` | 1665–1668 |
| MONTHLY AUDIT EXPORT | `ynx` | 1669–1669 |
| MONTHLY AUDIT EXPORT | `auditExportWorkbook` | 1670–1707 |
| MONTHLY AUDIT EXPORT | `exportDashboard` | 1708–1785 |
| MONTHLY AUDIT EXPORT | `downloadAuditExport` | 1786–1787 |
| MONTHLY AUDIT EXPORT | `AuditExports` | 1788–1802 |
| PEOPLE | `PeopleTable` | 1804–1823 |
| PEOPLE | `PersonForm` | 1824–1851 |
| PEOPLE | `People` | 1852–1857 |
| PROGRESS | `Progress` | 1859–1912 |
| SETTINGS | `Settings` | 1914–1944 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `ECA` | 1946–1946 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `MEASURES` | 1947–1953 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `APPROVAL_TONE` | 1954–1954 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `approvalOf` | 1955–1955 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `activityAll` | 1956–1956 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `curMonth` | 1957–1957 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `monthLabel` | 1958–1958 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `monthShort` | 1959–1959 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `shiftMonth` | 1960–1960 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `fmtWhen` | 1961–1961 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `one` | 1962–1962 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `normName` | 1963–1963 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `sameNameCount` | 1964–1964 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `personLabel` | 1965–1967 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `guessStoreType` | 1968–1973 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `storeTypeOf` | 1974–1974 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `activeStoreTypes` | 1975–1977 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `scoreMonth` | 1978–2012 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `snapRows` | 2013–2013 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `snapOf` | 2014–2014 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `monthStatus` | 2015–2015 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `boardFor` | 2016–2020 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `knownMonths` | 2021–2025 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `reviewQueue` | 2026–2028 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `recipientsFor` | 2029–2035 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `fillTemplate` | 2036–2042 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `mulberry` | 2043–2043 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `seedDemo` | 2044–2078 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `seedSnapshots` | 2079–2090 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `rollMonths` | 2091–2101 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `ecaReducer` | 2102–2146 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `scoringText` | 2147–2147 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `resultsText` | 2148–2149 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `requireAdmin` | 2150–2159 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `ApprovalChip` | 2160–2160 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `Medal` | 2161–2161 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `BoardStatus` | 2162–2166 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `Login` | 2167–2200 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `ElevateSheet` | 2201–2212 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `Podium` | 2213–2219 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `ScoreCard` | 2220–2229 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `BoardTable` | 2230–2240 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `MonthBoard` | 2241–2272 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `ScoringRules` | 2273–2280 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `DrillSheet` | 2281–2293 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `ReviewQueue` | 2294–2317 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `Bars` | 2318–2324 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `YearRound` | 2325–2363 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `ResultsAdmin` | 2364–2375 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `FinaliseSheet` | 2376–2384 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `DistributeSheet` | 2385–2407 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `Leaderboard` | 2408–2421 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `AdminAccess` | 2422–2430 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `StoreTypesCard` | 2431–2446 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `ScoringCard` | 2447–2462 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `ResultsSettingsCard` | 2463–2475 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `LOG_CATS` | 2476–2476 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `catOf` | 2477–2477 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `AuditHistory` | 2478–2489 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `LoginLog` | 2490–2501 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `SHARED` | 2502–2502 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `NO_TOMBSTONE` | 2503–2503 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `hashStr` | 2504–2504 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `keyOf` | 2505–2505 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `docIdOf` | 2506–2506 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `canon` | 2507–2507 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `cfgOf` | 2508–2508 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `COL_SORT` | 2509–2513 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `sharedBase` | 2514–2517 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `Sync` | 2518–2600 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `SyncHelp` | 2601–2616 |
| ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION | `SyncChip` | 2617–2627 |
| APP | `App` | 2629–2674 |