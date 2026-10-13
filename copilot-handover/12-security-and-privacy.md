# 12 · Security and privacy

## Data held and its sensitivity

| Data | Examples | Sensitivity | Where (prototype) |
|---|---|---|---|
| Staff roster | Names, role, state, reporting line of 102 people (incl. student employees) | Internal / personal | `src/app.js` (ADMINS, MANAGERS, SM_ROSTERS, LEADS), `config/roster.json`, `docs/power-platform/state_dump.json`, build pack |
| Store contacts | Contact name, role, phone, email of store staff | Personal (third parties) | Shared database `locations` (phone/email), `visits` (name/role). Workbook contacts are masked in `data.json` |
| Store commercial data | Ranging, prices, facings, competitor execution, outcomes | Commercially sensitive | Seed data, shared database, exports |
| Performance | Scores, ranks, audit counts per Student Marketeer | Internal / personal | Snapshots, leaderboard, exports |
| Activity logs | Sign-ins, actions with user names | Internal | `log`, `logins` |
| Photos | Store photos | Not stored (count only) | — |
No payment data, government IDs or health data. Student Marketeers' own ages or study details are not collected.

## Prototype controls and their limits (must be fixed in production)

| Area | Prototype | Limit | Production requirement |
|---|---|---|---|
| Identity | Name typed at sign-in, matched to the approved list | Anyone with the link who knows a name can sign in as that person | Entra ID sign-in with MFA |
| Admin step-up | Shared PIN; default is in the source (`DEFAULT_REF.adminPin`) and shown in the PIN field hint | Not a secret. Anyone reading the code or the hint knows the default | Entra ID MFA / PIM; no shared PIN. **Until then: change the PIN in Settings and fix the hint** (`13-known-issues.md`) |
| Authorisation | Enforced in the UI (`D.can`, scope filters) | In shared mode every record (incl. contact phone/email) is in the artifact database readable by anyone who can open the artifact; hiding is client-side only | Dataverse security roles, Business Units per state, column security on contact phone/email, row-level access |
| Link sharing | Live artifact shared "Anyone with the link" | Unsigned visitors can open the page (cannot write) and read seeded store data | Share with the organisation only; production app shared to Entra groups |
| Local storage | Full state copy in the browser's localStorage | Shared/kiosk devices keep data | Dataverse only; no local copy beyond app cache |
| Audit log | Append-only in the app; stored in the shared database | A technically capable user could write to the database directly | Dataverse auditing + append-only table (Create/Read only for all roles) |
| Exports | Generated in the browser for Managers/Admins | Files leave the system | SharePoint library with state-scoped permissions; sensitivity label "Internal" |

## Security roles for production (Dataverse)

| Table group | ECA Student Marketeer | ECA Manager | ECA Administrator |
|---|---|---|---|
| Institution, Campus, Store Location Type, Competitor | Read (org) | Read (org); Create/Write (BU) | Full (org) |
| Location | Read (BU); Create (BU) | Read/Create/Write (BU) | Full (org) |
| Location: contact phone/email columns | Create/Update only (column security, no read) | Read/Update | Read/Update |
| Audit Visit, Visit Competitor | Create (user), Read (BU), Write own within 48 h (flow-enforced) | Read/Write/Approve (BU) | Full (org); finalised-month edits logged |
| ECA User | Read (BU) | Read/Create/Write (BU, not Administrators) | Full |
| Leaderboard Snapshot / Rows | Read (org) | Read (org) | Full |
| Removal Request | Create/Read own | Read (BU) | Full; decide if Channel Lead |
| Monthly Report | — | Read own state | Read all |
| Scoring Rule Set, Distribution Settings | Read | Read | Full (MFA) |
| Audit Log, Sign-in Event | — | Read (BU) | Read (org); nobody updates/deletes |

## Privacy rules for Copilot and developers
- Do not paste roster names, store contacts or performance data into prompts, test fixtures, screenshots for public docs or issue trackers. Use synthetic records (e.g. "Test Marketeer", "Store A").
- Keep `config/roster.json`, `docs/power-platform/state_dump.json` and the build pack in an access-controlled SharePoint library. Do not upload them directly into a Copilot agent's generative-answers node (files uploaded there can become visible to anyone who chats with the agent).
- Contact phone/email are collected for business follow-up only; tell store staff why when collecting (production: add a one-line notice under the contact fields).
- Retention (recommend, to confirm with Red Bull privacy): audit data 3 years; logs 2 years; store contacts reviewed yearly and removed when a store closes.
- Secrets: none exist in the prototype except the default admin PIN. Production secrets live in Key Vault–backed environment variables.

## Known exposure to act on now
1. Change the live admin PIN (Settings → Admin PIN) and share the new one only with Administrators.
2. Set the live artifact's sharing to the organisation (not "Anyone with the link").
3. Remove the PIN value from the PIN field hint in `ElevateSheet` (source change, then republish).
