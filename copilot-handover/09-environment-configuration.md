# 09 · Environment and configuration

## Prototype
The prototype reads **no environment variables** at runtime. All configuration is reference data:

| Setting | Default | Where set | Who can change |
|---|---|---|---|
| Visit cycle (days) | 14 | `DEFAULT_REF.defaultCycle`; per location `cycle` | Admin (Settings; read-only for others since v30), Manager per location |
| Due-soon window | 3 days | `dueSoonDays` | Admin |
| Reminder lead time | 3 days | `reminderLeadDays` | Admin |
| Daily summary time | 18:00 | `dailySummaryTime` (prototype: only the Email log "Scheduled" label; inbox items are always dated 18:00) | Admin |
| Approval mode | Manager approval | `approvalMode` ('manager' / 'auto') | Admin (step-up) |
| Scoring weights | Ranging 30, TDP 25, Editions 20, POS 15, Coolers 10 | `scoring.weights` | Admin (step-up) |
| Normalisation | Relative to leader | `scoring.method` ('relative' / 'target') | Admin (step-up) |
| Targets | TDP 12, Editions 8, POS 10, Coolers 2 | `scoring.targets` | Admin (step-up) |
| Minimum approved audits | 3 | `scoring.minAudits` | Admin (step-up) |
| Store location types | QSR, Vending, Student Bar, Convenience, NKA | `storeTypes` | Admin (no step-up) |
| Products (ranging) | 4 Red Bull + 6 competitor SKUs | `products` | Code change |
| Competitor brands | Monster, V, Solo Energy, Rockstar, Celsius (+ None) | `competitors` | Code change; SMs add others per audit |
| Contact roles | Owner … Other (7) | `contactRoles` | Code change |
| Results distribution | Leads + Admins + SMs, Email and in-app, business day 3, template | `results` | Admin |
| Admin PIN | prototype default (see `12-security-and-privacy.md`) | `adminPin` | Admin (Settings) |
| States and Education Channel Leads | 5 states; leads per state | `DEFAULT_STATES`, `LEADS` | Admin |
| Monthly summary time | 1st of month 08:00 (display) | `summaryTs` | Code |
| Audit export time | last calendar day 18:00 (display) | `monthLastDay`, inbox item | Code |
| Saved data key | `edu-audit-national-v2` | `STORE_KEY` | Code (changing it orphans saved data) |

A snapshot of these values is in `project/config/reference-values.json` (PIN omitted). In shared mode, Admin changes to `states`, `leads`, `ref` and `lastMonth` are stored in the `config/main` document and apply to everyone.

## Tests and build
See `project/.env.example`:
- `CHROMIUM_PATH` — optional path to a Chromium/Chrome binary for Playwright. Blank = Playwright's own browser. When set, tests launch with `--headless=new` (required by current Chrome builds).
- Node ≥ 18, Python ≥ 3.9 (`openpyxl` only for `scripts/build_pack.py` and `scripts/extract.py`).

## Production (Power Platform) — values to configure
| Variable | Purpose |
|---|---|
| `DATAVERSE_ENVIRONMENT_URL` / `POWER_PLATFORM_ENVIRONMENT_ID` | Target environment (separate Dev, Test, Prod) |
| `SHAREPOINT_REPORTS_LIBRARY` | Where monthly Excel files are saved |
| `OUTLOOK_SENDER_MAILBOX` | Shared mailbox for notifications and results |
| `TEAMS_RESULTS_CHANNEL_ID` | Optional Teams post for monthly results |
Store these as **Power Platform environment variables** in the ECA solution; connection references for Dataverse, Outlook, Teams, Approvals, SharePoint, Excel Online. Secrets (if any service credentials are ever needed) go in Azure Key Vault–backed environment variables, never in app formulas or flows.

## Time zone
The prototype uses the device's local date for "today", due dates and month boundaries. Production must choose one rule (recommended: Australia/Sydney for month boundaries and scheduled flows; user's local date for visit dates) — open decision in `13-known-issues.md`.
