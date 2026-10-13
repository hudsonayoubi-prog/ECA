# Education Channel Audit Tool (ECA)

Mobile-first store-audit app for Red Bull Australia's student marketing team: Student Marketeers audit campus stores and vending machines (contacts, ranging, front facings and share of shelf, competitor execution, outcomes); Managers approve; a monthly National Leaderboard scores performance; monthly summaries and an Excel audit export with an executive chart dashboard are generated automatically.

This repository is the **working prototype** (v30, 13 Oct 2026) and the design pack for the **Power Platform** production build. Start with `../copilot-handover/00-START-HERE.md`.

## Quick start
```bash
npm install                      # react, react-dom, htm, playwright (dev only)
npx playwright install chromium  # or set CHROMIUM_PATH (see .env.example)
npm run build                    # → public/index.html (the app) and tests/index.html
npm test                         # 15 end-to-end suites; each must PASS
```
Open `public/index.html` in a browser to use the app locally (data stays in that browser). Try signing in as an administrator, a manager or a Student Marketeer from `config/roster.json`.

## Layout
| Path | What |
|---|---|
| `src/app.js` | All logic and UI (React 18 + htm, no JSX, no bundler) |
| `src/head.html` | Title, fonts, design tokens and CSS |
| `src/data/data.json` | Seed data from the VIC Excel tracker (215 locations, 103 visit dates; contacts masked) |
| `public/index.html` | Built single-file app — identical to the live claude.ai artifact |
| `scripts/` | `build.py`, `run-tests.sh`, `extract.py` (Excel → data.json), `build_pack.py` (Dataverse build pack) |
| `tests/` | Playwright suites, `fakedb.js` (shared-database stand-in), `screenshots.js` |
| `assets/screenshots/` | 31 reference screenshots |
| `docs/power-platform/` | Dataverse build pack, Power Fx starter formulas, data snapshot |
| `docs/excel-history/` | Scripts that built the original Excel trackers (v1–v3) and key formulas |
| `config/` | Reference values and roster snapshots (internal data — keep access-controlled) |

## Rules
See `CONTRIBUTING.md` and `COPILOT-INSTRUCTIONS.md`. Never edit `public/index.html` directly.
