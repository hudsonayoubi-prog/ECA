# 06 · Technical architecture

## Part A — The prototype (what exists)

```
                 ┌──────────────────────── public/index.html (one file) ────────────────────────┐
 src/head.html ─►│ <title>, Google Fonts link, <style> design tokens + all CSS                   │
 src/data/       │ <script id="seed" type="application/json"> VIC workbook data </script>        │
   data.json ───►│ React 18.3.1 + ReactDOM 18.3.1 (cdnjs) · htm 3.1.1 (jsDelivr) — pinned        │
 src/app.js ────►│ <script> app: config → pure logic → reducers → components → Sync → App </script>│
                 └──────────────────────────────────────────────────────────────────────────────┘
                          │ runs in a claude.ai artifact (sandboxed iframe)
                          ▼
   window.claude.use('db')        shared artifact database (collections below), live via onSnapshot
   window.claude.use('user')      can this viewer write?
   window.claude.use('downloads') offer generated .xlsx files to the viewer
   window.claude.use('permissions') diagnostics for the "This browser only" help
   localStorage['edu-audit-national-v2']  per-browser copy / fallback when not in claude.ai
```

### Layers inside `src/app.js`
1. **htm adapter** (1–20): `h()` maps HTML attribute names to React props and parses style strings.
2. **Config / reference values** (22–145): `DEFAULT_REF` (products, statuses, POS types, competitors, contact roles, channels, classifications, Bullring/Eye, vending companies, removal reasons, visit rules, store types, scoring, approval mode, admin PIN, results distribution), `DEFAULT_STATES`, `ADMINS`, `MANAGERS`, `SM_ROSTERS`, `EXTRA_UNIS` (all non-workbook institutions incl. TAFEs), `LEADS`, `STATUS`, `NAME_FIXES`, `ROSTER_REV`.
3. **Pure logic** (146–180): dates (local), `locationStatus`, `rangeStart`.
4. **Data access** (181–210): `DataService` (localStorage), `seedPeople`, `seedState`.
5. **State** (211–321): `reducer` for data actions; `notify`; `stamp` (audit log).
6. **Derived data and permissions** (322–411): `useDerived` (scope, permissions `can`, enriched locations with status/due/last visit), `filterLocs`, `summarise`, `dailySummaries`.
7. **UI components and pages** (412–1260 and 1803–1944): see `05-component-catalogue.md`.
8. **Excel writer, monthly summaries, execution metrics, audit export** (1261–1802), placed between the Notifications and People pages.
9. **ECA module** (1945–2501): scoring, snapshots, demo data, `rollMonths`, `ecaReducer`, login, leaderboard, admin settings, audit and sign-in logs.
10. **Shared storage** (2502–2627): `Sync`, `SyncHelp`, `SyncChip`.
11. **App** (2628–end).

### State model
- One immutable state object `s` (see `07-data-model.md`) held by `useReducer`. Every change is an action (`d({ type, … })`). Data actions write audit-log entries (`stamp`).
- **Derived** values are never stored: location status, due dates, scores, summaries, exports and charts are recalculated from records on render (`useMemo`). That is why "updates daily" needs no job: opening the page recalculates.
- **Time-based events** are computed, not scheduled: daily summaries appear at 18:00 for days with ≥ 2 audits; monthly summaries are dated the 1st 08:00; audit exports the last calendar day 18:00; `rollMonths` closes past months on first load in a new month.

### Persistence and sync (`Sync`, 2518–2600)
- **Shared mode** (inside claude.ai with the `db` capability granted): collections `people`, `locations`, `unis`, `visits`, `snapshots`, `requests`, `notifications`, `log`, `logins` (keys in `SHARED`) plus one document `config/main` (states, leads, ref, lastMonth).
- **Base + overrides:** the seed data is the base; the database holds one document per record that differs from the base (`_key` = record key). Deleted records are tombstones (`_deleted: true`) except for append-only collections (`notifications`, `log`, `logins`).
- **Writes:** after each state change `Sync.diff` compares each record's canonical JSON with the last known value and enqueues only changed records; `flush` writes one at a time, retries once on `unavailable`, switches to read-only on `invalid_argument`, warns on `quota_exceeded`. Pending writes overlay incoming snapshots so local edits never flicker.
- **Reads:** `onSnapshot` per collection rebuilds that collection (`build`) and dispatches `remote`; `sharedReady` fires when every collection and config has loaded (then `rollMonths`).
- **Local mode** (opened outside claude.ai, permission denied, or signed out): localStorage only; chip says "This browser only".
- **Not shared (per browser):** drafts, read markers, demo leaderboard activity, session (`me`, `authed`, `elevatedUntil`).

### Migrations on load (`App`)
`ROSTER_REV` (reporting lines), `NAME_FIXES` (Mill → Milla), `ecaRev` 1 (ECA upgrade), 2 (store types list), 3 (demo facings), `EXTRA_UNIS` (adds any missing institution by code). Pattern: compare a revision number or presence, transform, log a System entry.

### Excel generation (client-side)
`XLSX_MINI.build(sheets)` writes OOXML parts and a stored (uncompressed) ZIP with CRC-32, no library. Sheets are either tables (title, notes, header row, frozen panes, autofilter, % columns, bold total rows) or raw layouts (merged cells, row heights, hidden gridlines). Charts: clustered bar/column `c:barChart` with cached category and value data, per-point colours, data labels, legends; anchored by `xdr:twoCellAnchor`. Files reach the viewer via the `downloads` capability (falls back to an `<a download>` click outside claude.ai).

### External dependencies
React 18.3.1, ReactDOM 18.3.1 (cdnjs.cloudflare.com), htm 3.1.1 (cdn.jsdelivr.net), Google Fonts (Barlow, Barlow Condensed). Tests: Playwright (Chromium). Build: Python 3. No server.

---

## Part B — Target production architecture (Power Platform)

```
 Student Marketeers / Managers / Admins (Red Bull Microsoft 365, Entra ID, MFA)
        │ Power Apps mobile / browser
        ▼
 Power Apps canvas app "ECA"  ── screens mirror the prototype (05-component-catalogue.md)
        │ Dataverse connector (delegable queries, row-level security)
        ▼
 Dataverse (publisher prefix eca_) — tables in docs/power-platform/ECA_Dataverse_Build_Pack.xlsx
   Business Unit per state · security roles: ECA Student Marketeer / ECA Manager / ECA Administrator
   Column security: contact phone/email · Auditing on · Logo image column
        │
        ├─ Power Automate (cloud flows)
        │    F1 Audit submitted → notify state Managers (Teams/Outlook + in-app row)
        │    F2 Removal request → Education Channel Lead approval (Approvals) → update records
        │    F3 Daily 18:00 → daily activity summaries
        │    F4 Daily 07:00 → SM visit reminders (due ≤ 3 days / overdue)
        │    F5 1st of month 00:05 → close month: create Leaderboard Snapshot (In review)
        │    F6 1st of month 08:00 → state summaries + national breakdown (Excel to SharePoint, Monthly Report row, email/Teams)
        │    F7 Last calendar day 18:00 → audit export per state + all states with Dashboard sheet (Office Scripts or template workbook)
        │    F8 Finalise (button in app) → lock snapshot, write audit log
        │    F9 Distribute results → email/Teams to chosen groups
        │    F10 Data quality → weekly: locations with no contact, store types to confirm, SMs without manager
        ├─ SharePoint document library "ECA Reports" (generated Excel files, permissions by state)
        └─ Power BI (optional) — executive dashboard on Dataverse, same measures as the Excel Dashboard
```

### Mapping prototype → production

| Prototype | Production |
|---|---|
| Name sign-in + `people` list | Entra ID; ECA User row linked by email / systemuser |
| Admin PIN step-up | Entra ID MFA / PIM; Administrator security role |
| `D.can` permission checks | Security roles + Business Units + column security; UI hides what roles can't do |
| `reducer` actions | Patch()/SubmitForm() to Dataverse; flows for side effects |
| `stamp` audit log | Dataverse auditing + `eca_auditlog` (append-only role permissions) |
| Computed notifications | Flows writing in-app rows + Teams/Outlook messages (real email) |
| `scoreMonth` | Power Fx collection logic or a flow that writes Snapshot Rows (see `docs/power-platform/powerfx.txt`) |
| `XLSX_MINI` exports | Flow + Office Scripts / Excel template with charts, saved to SharePoint, listed via Monthly Report table |
| Logo data URL on institution | Dataverse Image column |
| Photos (count only) | Dataverse File/Image column or Notes attachments |
| `rollMonths` on page load | Scheduled flow F5 |
