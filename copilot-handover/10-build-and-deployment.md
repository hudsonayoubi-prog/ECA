# 10 · Build and deployment

## Prototype

### Build
```bash
cd project
python3 scripts/build.py          # or: npm run build
```
Joins `src/head.html` + `src/data/data.json` (inline `<script id="seed" type="application/json">`, `</` escaped) + pinned CDN script tags + `src/app.js` into **`public/index.html`**. Also writes `tests/index.html`, the same page pointing at `../node_modules` (React development build, htm) with Google Fonts disabled, for offline tests.

The page starts with `<title>` and the `<link>`/`<style>` block (the claude.ai publisher wraps it in a document skeleton). Opening `public/index.html` directly in a browser also works (local mode: data stays in that browser).

### Refresh seed data from the Excel tracker
```bash
python3 scripts/extract.py Education_Channel_Execution_Tracker_v3.xlsx src/data/data.json
```
Reads each university tab's location and visit tables, staff allocations and the as-of date, and masks store contacts (first letter + •••, phones replaced) and names in notes. Output keys: `unis`, `locations`, `visits`, `allocations`, `asOf`. Then rebuild. Note saved data in browsers/the shared store is not overwritten by new seed data; add a migration (see CONTRIBUTING.md).

### Publish (current host: claude.ai artifact)
The live ECA is a private claude.ai artifact owned by Hudson (v30 at packaging). It is published from `public/index.html` with capabilities **db, user, downloads**. Re-publishing the same artifact keeps its URL, its shared database and its declared capabilities. Changing the capability set must restate all three or shared storage stops working. Copilot cannot publish there; a person does it from Claude.

Alternative static hosting (not recommended for real data): the file runs on any static web host in **local mode only** (no shared data, downloads via the browser).

### Regenerate the Dataverse build pack
```bash
python3 scripts/build_pack.py docs/power-platform/state_dump.json docs/power-platform/ECA_Dataverse_Build_Pack.xlsx
```
`state_dump.json` is a snapshot of the prototype's seed state (people, institutions, locations, visit history, reference values) taken from a fresh load. Recalculate formulas afterwards in Excel (or LibreOffice) and check the **Checks** sheet shows OK.

## Production (Power Platform) deployment

1. **Environments:** Dev, Test, Prod Dataverse environments; one unmanaged **ECA** solution in Dev with publisher prefix `eca_`.
2. **Schema:** create tables and columns from "Tables & columns" in the build pack (with choices from "Choices"). Turn on auditing. Add the Image column `eca_logo` on Institution.
3. **Security:** Business Unit per state under the root BU; security roles *ECA Student Marketeer*, *ECA Manager*, *ECA Administrator* (see `12-security-and-privacy.md`); column security profile for contact phone/email; Entra ID security groups per role/state mapped to Dataverse teams.
4. **Data import:** sheets 1–13 in order (Read me → Import order). Fill Red Bull emails first. Fix the Checks sheet to all OK.
5. **App:** Power Apps canvas app (phone layout first, responsive), screens per `05-component-catalogue.md`, formulas from `docs/power-platform/powerfx.txt` as a starting point.
6. **Flows:** F1–F10 in `06-technical-architecture.md` Part B, with environment variables and connection references.
7. **Reports:** SharePoint library "ECA Reports"; Excel template or Office Script producing the Dashboard + Summary + per-state sheets exactly as `auditExportWorkbook`/`exportDashboard`.
8. **ALM:** export the solution as managed; deploy to Test → user acceptance against `11-testing-and-acceptance.md` → Prod. Use Power Platform Pipelines or Azure DevOps Power Platform Build Tools.
9. **Rollout:** pilot one state (VIC has data), then NSW, QLD, SA, WA. Share the app with Entra groups; publish to Teams if wanted.
10. **Cut-over:** freeze the prototype, export its shared data (ask Claude to read the artifact database, or use the in-app Excel exports), import into Dataverse, then retire the artifact link.
