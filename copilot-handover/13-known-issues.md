# 13 · Known issues and open decisions

## A. Known issues in the prototype

| # | Issue | Impact | Fix / workaround |
|---|---|---|---|
| K1 | Admin PIN default is in the source and printed in the PIN field hint ("Prototype PIN: …") | Admin step-up gives no real protection | Change the PIN in Settings; remove the value from the hint in `ElevateSheet`; production uses Entra MFA |
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
