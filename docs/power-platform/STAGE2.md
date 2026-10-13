# Path 2 · Stage 2 — Data import

Status: **validated offline against the build pack. Not loaded into any environment** (needs Stage 1 applied first).

## Validate (no network, safe anywhere)
`npm run pp:import:check` checks all 13 data sheets: headers map to real columns, choice labels are valid, every lookup resolves, keys are unique, expected counts (5 states, 102 users = 16/16/70, 59 institutions, 215 locations, 103 visits), scoring weights total 100, exactly one current rule set. It prints counts only, never names or contacts.

Current result: **passes**, with three warnings you must act on:
1. **All 102 users have no email.** Needed for Microsoft sign-in. Either fill the yellow Email column in sheet 3, or pass a CSV: `python3 scripts/pp_import.py --emails emails.csv` (columns `Full Name,Email`; `emails*.csv` is git-ignored).
2. **8 Student Marketeers have no Reports To** (the VIC workbook staff). Decide their Manager.
3. **215 locations have Type Confirmed = No.** Store types were guessed; confirm in the app after go-live, especially Convenience.

## Load (Dev/Test)
```
export DATAVERSE_URL=...  DATAVERSE_TOKEN=...
python3 scripts/pp_import.py --apply            # all sheets, in the pack's order
python3 scripts/pp_import.py --apply --only 8   # one sheet
```
- Upserts on each table's primary-name key, so re-running is safe.
- Order: States, Store Types, Competitors, Users (no Reports To), Reports To (second pass), Channel Leads, Institutions, Campuses, Locations, Allocations, Visit history, Scoring Rule Set, Distribution Settings.
- Visit history loads with Imported = Yes and no staff member, so it sets due dates but never scores.
- Stops at the first failure and says which sheet.

## Check after loading
102 users, 59 institutions (38 University + 21 TAFE), 215 locations, 103 visits, 5 competitors. Then link ECA User to the Microsoft account by email (`eca_systemuser`).

## Not verified / to know
- Never run against a live Dataverse. First `--apply` may need small fixes (entity set names are read from the environment, so lookups should bind).
- Duplicate full names would break the name key. None exist now; add a Disambiguation Label if one appears.
- Store contacts are blank in the pack (masked in the prototype). Copy from the v3 workbook if wanted.
- Scoring weights are recommendations to confirm with Sales; Effective From assumes 1 Nov 2026.
