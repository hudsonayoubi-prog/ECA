# Path 2 · Stage 1 — Dataverse schema and security

Status: **generated and tested offline. Not yet applied to any environment** (needs a Dev environment and an admin sign-in).

## What is here
| File | What |
|---|---|
| `schema/eca-schema.json` | The build pack as data: 21 tables, 253 columns (238 in the workbook + 15 in `schema/extensions.json`), 25 choice sets, 13 alternate keys |
| `security/security-model.json` | Business Units, teams, role grants, column security, auditing |
| `../../scripts/pp_schema.py` | Rebuilds the JSON from `ECA_Dataverse_Build_Pack.xlsx` (the workbook stays the source of truth) |
| `../../scripts/pp_deploy.py` | Creates everything in Dataverse via the Web API. Dry run by default; safe to re-run |
| `../../tests/pp/test_pp.py` | Offline checks (`npm run test:pp`) |

## How to apply (Dev environment only)
1. Create an unmanaged solution `ECA` with publisher prefix `eca`.
2. `az login`, then `export DATAVERSE_URL=https://<org>.crm6.dynamics.com` and `export DATAVERSE_TOKEN=$(az account get-access-token --resource $DATAVERSE_URL --query accessToken -o tsv)`.
3. `npm run pp:plan` to read the plan, then `python3 scripts/pp_deploy.py --apply`.
4. Create the Business Units, teams and security roles from `security/security-model.json`, then the column security profile (enable column security on the three contact columns first).
5. Turn on auditing for the environment.
6. Check: 21 tables, 253 columns; a test SM cannot read another state's locations or any contact phone/email.

## Assumptions to confirm (also in `copilot-handover/13-known-issues.md`)
- **Visit ID** is "Autonumber or text" in the pack. Created as text (50) so history and the app can write IDs like `MON-V0001`.
- **Choice values** start at 100000000 in the order on the Choices sheet.
- **Two choice sets** are not on the Choices sheet and were added from inline labels: Institution Status (Active/Removed) and Removal Status (Pending/Approved/Rejected).
- **Alternate keys:** the pack names Location ID and Snapshot Month. Keys on every imported table's primary name were added so imports can upsert and lookups can bind by name (13 keys).
- **Not verified against a live tenant.** The payloads follow the Dataverse Web API metadata format but no call has been made. Expect small fixes on first `--apply` (Dev only). Lookup logical names follow the pack; relationship names are generated.
- **Manager can't edit Administrators** is a design note, not yet a tested rule. Check it in Test.
