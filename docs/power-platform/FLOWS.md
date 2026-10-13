# Path 2 · Power Automate flow design (F1 to F10)

Design only. **Nothing here is built or tested in Power Automate.** It tells whoever builds the flows what each one does, with the rule behind it and the repo code that is the reference. Source of the list: `copilot-handover/06-technical-architecture.md` Part B. Rules: `copilot-handover/02-business-requirements.md` (BR-xx).

## Decisions needed from Hudson before building
| # | Decision | Why it matters | Recommendation |
|---|---|---|---|
| 1 | **Where do the calculations run?** Power Automate cannot run Python. | Scoring, summaries and Excel files are tested Python (`pp_scoring.py`, `pp_monthly.py`, `pp_export.py`). | **A. Azure Function (Python) called over HTTP** from the flows: reuses tested code with parity tests, but needs an Azure subscription, IT approval and the premium HTTP connector. **B. Rebuild in Power Fx and Office Scripts**: no Azure, but it is a rewrite with no parity proof. Pick A if Red Bull IT will host it. |
| 2 | **In-app notifications have no table.** The prototype stores them (`notifications`); the Dataverse build pack has no notification table. | F1, F2, F4 say "in-app row". Without a table the app shows only Teams/email, or computes its inbox like the prototype does. | Add an `eca_notification` table (to, kind, title, body, link, read) in Stage 1, or drop in-app rows and use Teams/email only. |
| 3 | **Time zone.** The prototype uses the device's local time. States span 2 to 3 time zones (WA is behind). | "18:00", "1st at 08:00" and "last calendar day" need one clock. | Run all recurrences on **AUS Eastern** (handles daylight saving). Confirm WA is fine with this. |
| 4 | **Teams or email?** | Each notification needs a channel. | Email from a shared mailbox for reports and approvals; Teams for per-audit alerts. |
| 5 | **Settings with no Dataverse home:** due-soon days (3), reminder lead days (3), default cycle (14), daily summary time. | Flows F3, F4 read them. | Store them as **environment variables** (or add a settings table). |
| 6 | **Removal note.** The prototype keeps `removedNote` on locations; Location has no such column. | F2 writes it when a request is approved. | Add `eca_removednote` (text 400) to Location, or write it to Latest Note. |
| 7 | **Step-up for Finalise and Distribute** (F8, F9) replaces the PIN. | BR-04. | Conditional Access authentication context on the ECA Administrators group (Entra MFA), plus a role check inside the flow. |

## Rules that apply to every flow
- **Run identity:** a dedicated service account (not a person) owns the flows; all connectors use **connection references** in the `ECA` solution. No keys in flows: the function key and mailbox are environment variables backed by Key Vault.
- **Time zone:** every Recurrence trigger set to AUS Eastern Standard Time. Compute "today" and "this month" in that zone.
- **Safe to re-run:** every flow checks for what it would create (alternate keys: Leaderboard Snapshot by month, Monthly Report by month + type + state) and skips it if present. A failed run can be re-run without duplicates.
- **Failure handling:** each flow wraps its steps in a Scope, with a failure branch that emails the ECA owners the run link and writes an `eca_auditlog` row (category Settings). Retry HTTP calls 3 times with backoff. A failed run is never silent.
- **Audit log:** flows write `eca_auditlog` rows as user "System" (BR-60). The log table is append-only for every role.
- **Counted audits:** Completed and not Rejected or Duplicate (summaries and exports). The leaderboard additionally needs Approved, a named Student Marketeer and Imported = No (BR-41).
- **Files:** saved to the SharePoint library `ECA Reports`, one folder per state, permissions by state group; Administrators see all.

## F1 · Audit submitted (BR-50, BR-37)
- **Trigger:** Dataverse "When a row is added or modified" on `eca_auditvisit`, column filter `eca_visitstatus`, row filter `eca_visitstatus eq Completed and eca_imported eq false`.
- **Steps:** 1) get the Location, Institution and State. 2) Set the location's **Last Completed Visit** to the visit date if later (the build pack says a flow does this, so every client gets it; Next Due is a formula column). 3) List active ECA Users with Role Manager in that state. 4) Send each a Teams message or email: Student Marketeer, location, institution, link to the audit. 5) Create `eca_notification` rows if decision 2 says yes.
- **Skip when:** the visit is imported history, or the state has no active Manager (write a log row instead).
- **F1b, decision notices:** same table, trigger on `eca_approvalstatus` changing to Rejected or Duplicate (BR-40). Notify the Student Marketeer with the reason or the audit it duplicates.
- **Not in this flow:** the app itself patches the Location's latest ranging, prices, facings, contact and competitor rows on submit (`docs/power-platform/powerfx.txt`, 6.3).

## F2 · Removal request (BR-51)
- **Trigger:** row added on `eca_removalrequest` with Status = Pending (only Student Marketeers create these; Managers and Administrators remove directly).
- **Steps:** 1) find the Channel Lead rows for the request's state; stop with a log row and an Administrator email if there are none. 2) "Start and wait for an approval" (first to respond, approve or reject) assigned to those Leads, with the target, reason and comments. 3) On approve: if the target is a store or vending machine, set the Location Status to Removed and write the removal note (decision 6); if it is a University or TAFE, set the Institution Status to Removed **and set every non-removed location of that institution to Removed with the note "Institution removed"** (this is what the app does). 4) Update the request: Status, Decided By (match the approver's email to ECA User), Decided On, Decision Note. 5) Notify the requester. 6) Audit log row.
- **Check:** only a Lead of that state can decide; only Pending requests are processed (a second response is ignored).

## F3 · Daily summaries (BR-52)
- **Trigger:** Recurrence, daily 18:00.
- **Steps:** find Student Marketeers with **2 or more** Completed, non-imported audits today; for each, total the audits, institutions, stores, vending machines, net DPs, Editions, POS, coolers and issues; send one summary to that state's Leads and Managers.
- **Findings wording** (see `dailySummaries` in `src/app.js`): "Distribution points +N (+a / −b)", "N Editions sold in", "N POS placed", "Coolers +a / −b", "Issue at STORE: text", else "No outcome changes recorded".
- **Build note:** the grouping is awkward in the flow designer, so do it in the function (decision 1) or a FetchXML aggregate. `dailySummaries` is **not ported to Python yet**, so no parity test exists for it.

## F4 · Visit reminders (BR-22)
- **Trigger:** Recurrence, daily 07:00.
- **Steps:** for each Active location whose Next Due is on or before today plus the reminder lead days (3) **or overdue**, find the Student Marketeer who last completed a visit there, and send one reminder per location: "Overdue" or "Due soon", location, institution, due text. Locations nobody has audited get no reminder.
- **Build note:** "last audited by" is derived (the latest Completed visit with a staff member), not a column. Use the function or a view.

## F5 · Close the month (BR-43)
- **Trigger:** Recurrence, 1st of the month 00:05.
- **Steps:** 1) find months from the last snapshot up to last month that have no Leaderboard Snapshot (catches missed runs). 2) For each, compute the month's scorecard (reference `pp_scoring.score_month`) using the **current** Scoring Rule Set. 3) Create the snapshot (Status In review, Created On, Rule Set, Unapproved Audits Excluded = Pending audits) and one Snapshot Row per Student Marketeer (`pp_scoring.snapshot_rows`). 4) Audit log "Monthly leaderboard reset: MONTH closed for review; scores start at zero" (category Leaderboard).
- **Idempotent:** Leaderboard Snapshot is keyed on month; skip if it exists.

## F6 · Monthly summaries (BR-53)
- **Trigger:** Recurrence, 1st of the month 08:00 (after F5).
- **Steps:** for last month: for each state, build the state summary workbook (`pp_export.build_monthly_workbook(d, month, state)`), then the national breakdown (`state = None`). Save to `ECA Reports/<state>/`. Create a Monthly Report row (type State summary or National breakdown, month, state, recipients, Generated On = 08:00 on the 1st, file link). Notify recipients: state Managers and that state's Channel Leads; national goes to active Administrators.
- **Month status line** in the workbook: the leaderboard is "in review" until F8 finalises it.

## F7 · Audit export (BR-54, BR-55)
- **Trigger:** Recurrence, daily 18:00, with a first step that stops unless tomorrow is the 1st.
- **Steps:** build the export for all states (`pp_export.build_export`) for Administrators, and one for each state for its Managers. Save to `ECA Reports`. Monthly Report row type Audit export (state blank = all). Notify "Audit export ready".
- **Month to date:** an on-demand version for the current month can reuse the same call from a button.

## F8 · Finalise a month (BR-44)
- **Trigger:** Power Apps button (Power Apps trigger) with the month as input.
- **Steps:** 1) check the caller is an Administrator (decision 7 for MFA) and the snapshot exists, is In review, and the month is over. 2) Recompute the scorecard so the locked rows are current. 3) Replace the Snapshot Rows, set Status Final, Finalised By and On, Rule Set, Excluded Pending. 4) Audit log "Finalised leaderboard".
- **After finalising:** edits to that month's audits need a Correction Reason and are logged as corrections; they do not change the locked board. Enforce with a second flow on `eca_auditvisit` modified: if the month is Final and no reason was given, revert and log.

## F9 · Distribute results (BR-45)
- **Trigger:** Power Apps button.
- **Steps:** 1) check Administrator and snapshot Final. 2) Read Distribution Settings: groups (Leads, Administrators, Student Marketeers, extra addresses), method, message template. 3) Build the recipient list from ECA User and send by method (Email and in-app, Email only, In-app only, Teams post and in-app). 4) Fill the template: `{first}`, `{second}`, `{third}`, `{month}`, `{ranked}`; names, ranks and scores only. 5) Create a Results Distribution row and an audit log row.
- **F9b, reminder:** on business day 3 of the month, if the previous month is Final but not distributed, remind the Administrators.

## F10 · Data quality (weekly)
- **Trigger:** Recurrence, Mondays 07:00.
- **Steps:** count Locations with no contact name, Locations with Type Confirmed = No, Student Marketeers with no Reports To, users with no email, duplicate full names without a Disambiguation Label, and competitors added from the field that are unreviewed. Email the Administrators one table with counts and links to filtered views.

## Build order I would use
1. F5 → F6 → F7 (reports; most value, least user interaction) once decision 1 is made.
2. F1, F1b, F2 (the people-facing alerts and approvals).
3. F8, F9 (needs the Power Apps screens and decision 7).
4. F3, F4, F10 (summaries and reminders; F3 and F4 need their logic ported and tested first).

## What I could not check
Everything above is unbuilt. Limits of Dataverse triggers, Approvals licensing, and the premium connector cost depend on Red Bull's tenant and licences. The Azure Function option (decision 1) is a design choice, not something I have built.
