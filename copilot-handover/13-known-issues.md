# 13 · Known issues and open decisions

## A. Known issues in the prototype

| # | Issue | Impact | Fix / workaround |
|---|---|---|---|
| K1 | Admin PIN default is in the source (the PIN field hint no longer prints it, fixed 13 Oct 2026) | Admin step-up gives no real protection | Change the PIN in Settings (the hint is already fixed); production uses Entra MFA |
| K2 | Name-only sign-in | Impersonation possible | Production: Entra ID |
| K3 | Authorisation is client-side; the shared database holds all records incl. contact phone/email | Technically capable viewers could read them | Production: Dataverse column/row security. Pilot: restrict artifact sharing to the organisation |
| K4 | Shared storage needs each viewer signed in to claude.ai and to allow the page's data use | People without claude.ai accounts only get "This browser only" (their entries stay on their device) | Power Platform build; help sheet explains |
| K5 | Photos are not stored (count only) | No photo evidence | Production: File/Image column or SharePoint |
| K6 | "Emails" are logged, not sent | Nobody is emailed | Production: Power Automate + Outlook/Teams |
| K7 | Demo leaderboard activity (with demo front facings) exists per browser for the 8 VIC workbook staff | Leaderboard, Progress Execution, monthly summaries and exports show "includes demo activity" figures | Admin → Settings → Remove demo leaderboard activity before real use |
| K8 | NSW, QLD, SA, WA institutions have no audit locations | Those states show zeros everywhere | Managers add locations in the app (or import) |
| K9 | Campus lists for new universities and TAFEs were set from general knowledge, not verified with each institution | Some campuses may be wrong or missing | Managers edit campuses in Universities & TAFEs; SA list to confirm with Teneisha Clarisse |
| K10 | Institution logos are not loaded | Tiles show code monograms | Admins/Managers upload official logo files (Edit → Logo) |
| K11 | Two ranging measures: Progress shows **current** ranging over all active locations; monthly reports show ranging at locations **audited that month** | Figures can differ | Both labelled; keep both definitions |
| K12 | Audit visit rows hold contact name/role only; phone/email live on the location | Audit export has no phone/email | Add to export for Managers/Admins if wanted |
| K13 | Month boundaries and "today" use the device's local date | Users in WA vs NSW can see different "today" near midnight | Decide production time-zone rule (D9 below) |
| K14 | Logos are stored as data URLs inside institution records in the shared database | Larger documents; fine at ≤ 160 px | Production: Image column |
| K15 | Store location types for the 215 VIC locations were auto-classified and flagged "to confirm" | Store-type reporting may be wrong | Audit Locations → Store type "To confirm" filter; confirm each |
| K16 | A duplicate artifact titled "Education Channel Audit Tool (ECA)" (no shared storage) was created by mistake on 9 Oct | Confusion over which link is live | Delete it; the live one has shared storage (URL ends …2nPXWsUqTj39JeDkpjSRms) |
| K18 | Fixed in v30 (13 Oct): any signed-in user could change the visit rules in Settings; new locations could not be added under 6-letter institution codes (GOTAFE, SWTAFE) | Was a defect | Fixed; covered by `tests/permissions.js` |
| K19 | Store location types, reference lists and the admin PIN change without step-up (Admin only) | Lower assurance than scoring changes | Production: Administrator role with MFA |
| K20 | The Daily summary time setting does not move the inbox time (always 18:00) | Cosmetic in the prototype | Production flow F3 uses the configured time |
| K17 | The original 9 Oct handover pack (ECA_Handover_Pack.zip) predates the 9–12 Oct changes | Out of date | Use this package instead |

## B. Decisions awaiting Hudson

| # | Decision | Notes |
|---|---|---|
| D1 | Who the 8 VIC Student Marketeers report to | VIC Managers: Phillip Petinella, Abi James, Patrick Blew, Josh Blew, Hannah Perry |
| D2 | Do Student Marketeers have Red Bull Microsoft accounts / licences? | Decides production sign-in and licensing (~102 users) |
| D3 | Email addresses for all 102 people | Fill in build pack sheet 3 |
| D4 | Agree scoring weights, relative vs targets, minimum audits | Currently recommendations |
| D5 | Who finalises each month; is business day 3 right? | |
| D6 | Should a Student Marketeer's edit send an audit back for approval? | Currently yes |
| D7 | Prize/reward rules for the podium | |
| D8 | Roles of Renee Christison and Chloe Salvemini; whether Managers without teams (e.g. Bronte Stock, Anthony Alam) stay Managers | |
| D9 | Production time zone for month boundaries and schedules | Recommend Australia/Sydney |
| D10 | Should Managers also receive the national breakdown? | Currently Admins only |
| D11 | Should phone/email be required at step 1? Should SMs see contact phone/email? | Currently optional and hidden from SMs |
| D12 | Which competitors should be on the standard list (e.g. add Prime, Celsius variants)? | SMs can add any brand per audit today |
| D13 | Retention periods for audit data, logs and store contacts | Recommendation in `12-security-and-privacy.md` |

## C. Risks
Impersonation (prototype), unagreed scoring, wrong auto store types, data drift between Excel/prototype/Power App, Copilot output variability, pilot data stranded in claude.ai, licence cost, approval backlog, personal data exposure on a shared link. Mitigations: Power Platform as system of record, Microsoft sign-in, agree scoring before launch, confirm store types, export pilot data before cut-over, restrict sharing.

## Path 2 · Stage 1 assumptions (added 13 Oct 2026)
See `docs/power-platform/STAGE1.md`: Visit ID created as text; two choice sets derived from inline labels; extra alternate keys; deploy script untested against a live Dataverse; Manager-cannot-edit-Administrators rule needs testing.

## Path 2 · Stage 2 (added 13 Oct 2026)
See `docs/power-platform/STAGE2.md`. Open: all 102 user emails blank; 8 VIC staff with no Reports To; 215 store types unconfirmed; import script untested against a live Dataverse.

## Path 2 · Scoring (added 13 Oct 2026)
See `docs/power-platform/SCORING.md`. Open: store-type/activity board filters, snapshot finalise, 48 h edit window and self-approval rule are not ported; accented-name tie-breaks may differ from the app.

## Path 2 · Monthly summaries (added 13 Oct 2026)
See `docs/power-platform/MONTHLY.md`. Open: Excel workbook, schedule and notices not built; accented-name tie-breaks may differ.

## Path 2 · Audit export (added 13 Oct 2026)
See `docs/power-platform/EXPORT.md`. Open: not opened in desktop Excel; chart styling may differ slightly; SharePoint save, schedule and notice not built; BR-53 summary download workbook not built.

## Path 2 · Summary workbooks (added 13 Oct 2026)
See the second half of `docs/power-platform/EXPORT.md`. Same open items as the audit export: not opened in desktop Excel; SharePoint save and notices not built.

## Flow design (added 13 Oct 2026)
See `docs/power-platform/FLOWS.md`: seven decisions needed before building (calculation hosting, missing notification table, time zone, Teams vs email, settings with no Dataverse home, removal note column, step-up for Finalise and Distribute). `dailySummaries` and the reminder logic are not ported to Python.

## Sign-in PIN (added 13 Oct 2026)
See BR-01a and D60. Open: until a person signs in for the first time their PIN is the public default 0000, so a new person's account is open to anyone who knows their name (mitigation: tell people to sign in soon after they are added, or an administrator can create the PIN for them). Lockout counts are per browser. Sessions already signed in keep working and are nudged only through Settings. Reference screenshots 01 and 20 show the old sign-in form (no PIN field) and need regenerating with `node tests/screenshots.js`.

## Hi5 audit changes, phase 1 (added 13 Oct 2026)
See BR-31, BR-31a, BR-32a and D61. Not done yet (phase 2): the separate **Vending audit** (location, vending company, availability and pricing, kept apart from the account list), **% penetration of each Hi5 KPI per campus and university**, **number of stores**, and adding the Hi5 columns to the Excel exports and summaries (the export and its Python port are unchanged, so exports do not show Hi5 yet). Known side effects: the location's competitor ranging is no longer updated by new audits, so the Progress screen's "competitors ranged at X%" figure goes stale for locations audited after this change; competitor presence is now better read from front facings. Low-cal is taken as Sugarfree or Zero and Win vs Comp as "more facings than the top competitor": please confirm. `05-component-catalogue.md` line numbers are out of date after the sign-in PIN and Hi5 changes; refresh with `node tests/screenshots.js`.
