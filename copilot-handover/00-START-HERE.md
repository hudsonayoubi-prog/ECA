# START HERE — Education Channel Audit Tool (ECA)

**Owner:** Hudson Ayoubi, National Student Marketing Manager, Red Bull Australia (Sydney)
**Package date:** 13 October 2026 · **App version:** live prototype v30 (claude.ai artifact)
**Purpose of this package:** let Microsoft Copilot (or any developer) reconstruct, maintain and extend the ECA with functional and visual parity, and rebuild it on Microsoft Power Platform for the national rollout.

---

## 1. What the ECA is, in one paragraph

A mobile-first web app for Red Bull Australia's student marketing team. **Student Marketeers** (70 people in five states) audit the stores and vending machines on university and TAFE campuses: who they spoke to, which Red Bull and competitor products are ranged, prices, front facings and share of shelf, competitor POS and coolers, and what they achieved (distribution points added, Editions sold in, POS and coolers placed). **Managers** approve audits for their state; a **monthly National Leaderboard** scores Student Marketeers; **Administrators** see everything nationally. Monthly state summaries, a national breakdown and an Excel audit export with an executive chart dashboard are generated automatically into the Notifications screen.

## 2. Two things exist — know which one you are working on

| | **A. The prototype (this repository)** | **B. The production build (to be made)** |
|---|---|---|
| What | One self-contained HTML page: React 18.3.1 + htm 3.1.1, all logic in `project/src/app.js` | Power Apps canvas app on Dataverse, Power Automate flows, optional Power BI |
| Where it runs | claude.ai artifact (private link) — needs a claude.ai account to share data | Red Bull Microsoft 365 — everyone signs in with Microsoft (Entra ID) |
| Data | Seed JSON in the page + shared artifact database (or the browser's localStorage) | Dataverse tables defined in `project/docs/power-platform/ECA_Dataverse_Build_Pack.xlsx` |
| Status | Working, tested, used for demos and a pilot | Designed, not built |

**Parity target:** the prototype is the executable specification. Production must reproduce its behaviour, rules and screens. Where the two must differ (identity, email, file storage) this package says how.

## 3. Read in this order

1. `01-project-overview.md` — scope, users, history, what "done" means
2. `02-business-requirements.md` — every rule, numbered (BR-xx), with acceptance criteria
3. `03-user-journeys.md` — step-by-step flows per role
4. `04-ui-design-system.md` — tokens, type, spacing, states, breakpoints, accessibility
5. `05-component-catalogue.md` — every screen and component, mapped to source lines and screenshots
6. `06-technical-architecture.md` — how the prototype works; target Power Platform architecture
7. `07-data-model.md` — prototype records and the Dataverse schema
8. `08-api-integrations.md` — artifact database, downloads, CDN, and production connectors
9. `09-environment-configuration.md` — settings, environment variables, reference values
10. `10-build-and-deployment.md` — build, publish, Power Platform deployment
11. `11-testing-and-acceptance.md` — automated tests and the acceptance checklist
12. `12-security-and-privacy.md` — roles, data sensitivity, what must change for production
13. `13-known-issues.md` — open issues, decisions awaiting Hudson
14. `14-decision-log.md` — every decision and who made it
15. `15-reconstruction-instructions.md` — exact steps to rebuild (prototype and Power Platform)
16. `COPILOT-INSTRUCTIONS.md` — operating rules for Copilot (also at `project/COPILOT-INSTRUCTIONS.md`)
17. `FILE-MANIFEST.csv` — every file in the package, its purpose and sensitivity
18. `glossary.json` — Red Bull and app terms (DP, TDP, QSR, NKA, Editions, share of shelf …)

## 4. Package layout

```
ECA_Copilot_Migration/
├── copilot-handover/          ← this knowledge base (upload to SharePoint and connect to Copilot)
└── project/                   ← the code repository (push to GitHub or Azure DevOps)
    ├── src/app.js             all logic and UI (≈2,670 lines)
    ├── src/head.html          page title, fonts, CSS design tokens and styles
    ├── src/data/data.json     seed data from the VIC Excel tracker (215 locations, 103 visits)
    ├── public/index.html      BUILT single-file app (identical to the live artifact v30)
    ├── scripts/               build.py, run-tests.sh, build_pack.py, extract.py
    ├── tests/                 15 Playwright end-to-end suites + screenshots.js + fake shared database
    ├── assets/screenshots/    31 reference screenshots (desktop and mobile)
    ├── docs/power-platform/   Dataverse build pack (xlsx), Power Fx snippets, data snapshot
    ├── docs/excel-history/    the scripts that built the original Excel trackers
    ├── config/                reference values and roster snapshots (JSON)
    ├── .env.example, package.json, README.md, CONTRIBUTING.md, COPILOT-INSTRUCTIONS.md
```

## 5. Quick facts Copilot will be asked about

- **Roles:** Student Marketeer, Manager, Administrator (plus "Education Channel Lead", an Administrator flag per state).
- **People:** 102 = 16 Administrators, 16 Managers, 70 Student Marketeers (VIC 8, NSW 27, QLD 16, SA 10, WA 9).
- **Institutions:** 38 universities + 21 TAFEs across VIC, NSW, QLD, SA, WA. Only VIC has audit locations (215) so far.
- **Store location types:** QSR, Vending, Student Bar, Convenience, NKA.
- **Visit cycle:** every location due every 14 days; "Due soon" = within 3 days.
- **Leaderboard weights:** Ranging 30, TDP 25, Editions 20, POS 15, Coolers 10; minimum 3 approved audits; resets monthly.
- **Monthly outputs:** state summaries + national breakdown on the 1st; audit export Excel (with Dashboard charts) on the last calendar day.
- **Admin PIN (prototype only):** a step-up PIN guards admin actions; production replaces it with Entra ID MFA. See `12-security-and-privacy.md`.

## 6. Ground rules (full version in COPILOT-INSTRUCTIONS.md)

- Source code and tests win over prose when they disagree. Record the conflict; do not silently pick.
- Do not redesign. Match the screenshots and the design tokens.
- No secrets or real personal data in code, prompts or fixtures. The roster in `config/roster.json` is internal staff data: keep it in access-controlled storage.
- Store this package in SharePoint (permissions respected) rather than uploading files directly into a Copilot agent.
