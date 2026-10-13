# 08 · APIs and integrations

The prototype has **no backend and no API keys**. It uses the claude.ai artifact runtime (when hosted there), two public CDNs and Google Fonts. Production replaces the runtime with Microsoft connectors.

## 1. claude.ai artifact runtime (prototype only)

Reached through `window.claude.use(name)`, which resolves a capability namespace or `null` (not hosted in claude.ai, not granted, signed out). The page must work when every call returns `null` — it falls back to localStorage. Declared capabilities on the live artifact: **`db`, `user`, `downloads`**.

| Capability | Calls used | Where | Failure handling |
|---|---|---|---|
| `db` | `collection(name).onSnapshot(cb, errCb)`, `collection(name).doc(id).set(body)`, `doc('config/main').onSnapshot(...)`, `.set(...)` | `Sync.start`, `Sync.flush` | `null` → local mode; `unavailable` → one retry after 0.4–1 s; `invalid_argument` → read-only; `quota_exceeded` → toast; failures counted and toasted ("n changes couldn’t be saved") |
| `user` | `can('data.write')` | `Sync.start` | `false` → read-only ("View only" chip) |
| `downloads` | `save({ filename, data: Blob })` | `offerDownload` | `declined` → "Download cancelled"; `rate_limited` → "A download is already waiting…"; other → "Downloads aren’t available here"; `null` → `<a download>` fallback |
| `permissions` (built in) | `state('db')` | `Sync.start` diagnostics, `SyncHelp` | read-only diagnostics, never prompts in a loop |

**Document shape:** each record is written whole with `_key` (its record key); deletions write `{ _deleted: true, _key }`. Document IDs are the key with unsafe characters replaced (`docIdOf`). Size limit per document is not hit in practice; logos are ≤ 160 px data URLs.

**Live data check (13 Oct 2026):** the shared store holds sign-in and log documents from 9–12 Oct, confirming shared mode works for signed-in viewers.

## 2. Static dependencies

| Dependency | URL | Version | Purpose |
|---|---|---|---|
| React | `https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js` | 18.3.1 pinned | UI runtime |
| ReactDOM | `https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js` | 18.3.1 pinned | Rendering |
| htm | `https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js` | 3.1.1 pinned | Tagged-template markup |
| Google Fonts | `https://fonts.googleapis.com/css2?family=Barlow…&family=Barlow+Condensed…` | — | Typography (system font fallback) |
If a CDN is unreachable the page does not start; tests use `node_modules` copies instead (see `scripts/build.py`).

## 3. Files in and out
- **In:** logo images (PNG, JPEG, SVG, WebP) via `<input type=file>`, resized in a canvas; audit photos (images, kept in memory only).
- **Out:** `.xlsx` workbooks generated in the browser (`XLSX_MINI`): monthly state summary, national breakdown, Progress export, monthly audit export (with Dashboard charts). CSV via clipboard (Progress → Copy CSV).

## 4. Production integrations (Power Platform)

| Need | Connector / service | Notes |
|---|---|---|
| Sign-in, identity, MFA | Microsoft Entra ID | Replaces name sign-in and admin PIN. ECA User linked by email/systemuser |
| Data | Microsoft Dataverse | Tables in `07-data-model.md` Part B. Use delegable filters (state, month) |
| Per-audit alerts, reminders, summaries | Power Automate → Office 365 Outlook (shared mailbox) and/or Microsoft Teams (chat/channel) | Real emails replace the prototype "Email log" |
| Removal approvals | Power Automate Approvals | Approver = state's Education Channel Lead(s) |
| Monthly Excel files | Power Automate + Excel Online (Business) with Office Scripts, or a template workbook with charts bound to tables | Save to SharePoint "ECA Reports"; write `eca_monthlyreport` row; notify |
| Report storage and permissions | SharePoint Online document library | Folder per state; Managers read own state; Admins all |
| Executive dashboard (optional) | Power BI | Same measure definitions as `07-data-model.md` |
| Photos | Dataverse File/Image column or SharePoint | Not stored in the prototype |
| Logos | Dataverse Image column on Institution | Upload in app; never fetched from the web |

**Rules for every flow:** run as a service account or the triggering user as designed; handle throttling (retry policy exponential, 4 tries); time out long Excel steps; log failures to `eca_auditlog`; never put personal data in flow names or Teams channel posts beyond names, ranks and scores.
