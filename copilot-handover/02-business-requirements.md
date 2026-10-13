# 02 · Business requirements

Each requirement has an ID (BR-xx), the rule, where the prototype implements it (`project/src/app.js` function names), and an acceptance test. "SM" = Student Marketeer. All dates are local (Australia) calendar dates.

---

## A. Access and identity

**BR-01 Approved users only.** Only people on the approved list (People screen) can sign in. Nobody can self-register.
**BR-01a Personal sign-in PIN (prototype).** Everyone signs in with their name and a personal PIN. Until a person chooses one, their PIN is the default **0000**; entering it takes them to *Create your PIN* before they get in. A PIN is 4 to 8 digits and cannot be 0000. Only a salted hash is stored on the person's record; creating, changing and resetting a PIN are logged (never the PIN). Five wrong attempts lock sign-in for 60 seconds. People change their own PIN in Settings; a Manager (own state) or Administrator (step-up) can reset it to 0000 in People. A PIN is a speed bump, not proof of identity: production uses Microsoft Entra ID and has no PIN. *Prototype:* `Login`, `ChangeMyPin`, `checkPin`, `pinHash`, reducer `setSignInPin`. *Tests:* signinpin, signin.
*Prototype:* `Login` matches first + last name (case, accents, hyphens and apostrophes ignored, see `normName`) against `people` names and `aliases`. *Production:* Microsoft Entra ID sign-in; the ECA User row is matched by email.
*Accept:* an unknown name shows "We couldn’t find that name on the approved user list…"; 5 failures lock sign-in for 60 seconds; deactivated users see "Your access is switched off".

**BR-02 Duplicate names.** When two active people share a name, sign-in asks the person to choose their profile, shown with the disambiguation label (e.g. campus).
*Prototype:* `Login` (choices list), `PersonForm` requires a "Label to tell them apart" when an Administrator ticks "This is a different person".

**BR-03 Roles and scope.** Three roles. SMs and Managers see only their state; Administrators see all states.

| Capability | SM | Manager | Admin |
|---|---|---|---|
| Start and submit audits | Own state | Own state | Any state |
| Edit own audit | Within 48 h, month not final | Any in state, month not final | Any; finalised month needs step-up + reason |
| Approve / reject / mark duplicate audits | ✗ | Own state (not own audits) | All (not own audits) |
| Add / edit locations | Add only | ✓ own state | ✓ |
| Add / edit universities & TAFEs, upload logos | ✗ | ✓ own state | ✓ |
| Request removal of a location or institution | ✓ | ✗ (removes directly) | ✗ (removes directly) |
| Decide removal requests | ✗ | ✗ | Education Channel Lead of that state |
| Manage people | ✗ | SMs and Managers in own state (can switch SM ↔ Manager without step-up) | Everyone; role changes made by an Administrator need step-up |
| See store contact phone / email | ✗ (write only) | ✓ | ✓ |
| Monthly summaries & audit exports | ✗ | Own state | National + every state |
| Progress Excel download | ✗ | ✓ | ✓ |
| Settings: scoring rules, results distribution | ✗ (view) | ✗ (view) | ✓ (step-up) |
| Settings: store location types, reference lists, admin PIN, visit rules (cycle, due-soon, reminder lead, daily summary time) | ✗ (view) | ✗ (view) | ✓ (no step-up) |
| Finalise and distribute monthly results | ✗ | ✗ | ✓ (step-up) |
*Prototype:* `useDerived` → `D.can`, `D.scopeStates`.

**BR-04 Admin step-up.** Sensitive admin actions need a second check: role changes made by an Administrator, scoring rule changes, finalising a month, distributing results, editing an audit in a finalised month. Once passed, admin tools stay unlocked 15 minutes; 3 wrong attempts lock the dialog.
*Prototype:* `requireAdmin` + `ElevateSheet` (PIN). *Production:* Entra ID MFA / PIM — never a shared PIN.

## B. Institutions and locations

**BR-10 Institutions.** Each university or TAFE has a code (2–6 capital letters, unique, used as the location ID prefix), name, short name, kind (University / TAFE), state, campuses, status (Active / Removed), optional note and optional logo.
*Accept:* tiles show the logo (or the code as a monogram), a **navy "University"** tag or a **yellow "TAFE"** tag, active / QSR / vending counts and fortnightly completion.

**BR-11 Institutions that span states** are separate records per state (e.g. ACU NSW `ACUN` and ACU Brisbane `ACUQ`; Southern Cross `SCU` NSW and `SCUG` Gold Coast; Notre Dame `UNDA` WA and `UNDS` Sydney). Adelaide University (`ADU`) is one record replacing the University of Adelaide and UniSA (2026 merger).

**BR-12 Logos.** Administrators and Managers (own state) can upload an official logo (PNG, JPG, SVG, WebP). The app scales it to max 160 px and saves it with the institution so everyone sees it. The app never draws or fetches logos itself.

**BR-13 Location IDs.** Store IDs are `CODE-001`, vending `CODE-VM-001` (CODE = the institution's 2–6 letter code, e.g. `GOTAFE-001`), next number = highest existing + 1, never reused. *Prototype:* `nextId`.

**BR-14 Store location type.** Every location has one of: **QSR, Vending, Student Bar, Convenience, NKA** (Admin-managed list; can rename or deactivate, not delete in use). Imported locations were auto-classified (Vending → Vending; NKA flag → NKA; names containing bar / pub / hotel / tavern → Student Bar; else QSR) and flagged "to confirm". *Prototype:* `guessStoreType`, `storeTypeOf`, `StoreTypesCard`.

**BR-15 Location status.** Active, Paused (Inactive) or Removed. Removed locations stay in history; a location with no visit history can be deleted.

## C. Visit cycle

**BR-20 Due dates.** Each location is due `cycle` days (default 14) after its last **Completed** visit, or after its date added if never visited. Scheduled and Cancelled visits do not reset the cycle.
**BR-21 Status.** Inactive if the location is not Active; otherwise *No Visit Recorded* if never completed; *Overdue* if due date < today; *Due Soon* if due within 3 days (`dueSoonDays`); else *On Track*. *Prototype:* `locationStatus` (pure function).
**BR-22 Reminders.** An SM gets an in-app reminder for each active location they last audited that is Overdue or due within `reminderLeadDays` (3).

## D. The audit (six steps)

**BR-30 Step 1 — Visit details.**
- State (Admins choose; others fixed to their state) → Institution type (Universities · n / TAFEs · n) → University or TAFE (each shown with its number of active locations) → Campus (optional filter) → Location.
- Changing state or type clears the institution, campus and location.
- Visit date/time (default now; Completed visits cannot be in the future), staff member (SMs default to themselves; Admin chooses), visit status (Completed / Scheduled / Cancelled).
- **Store contact:** name (required for Completed), role (Owner, Manager, Assistant manager, Supervisor, Buyer / purchasing, Staff member, Other), phone (optional; ≥ 8 digits), email (optional; valid format). Name and role prefill from the location. Phone and email prefill only for Managers and Admins; an SM sees "A number is on file. Leave blank to keep it."
*Prototype:* `Audit` body[0], `validate`.

**BR-31 Step 2 — Ranging.** Yes / No for every product that applies to the location type (QSR: 10 products; Vending: ED, SF, Zero, Editions, Monster, V). Answers prefill from the last audit; all must be answered for a Completed visit.

**BR-32 Step 3 — Pricing & execution (front facings and competitors).**
- Red Bull front facings (DPs), stepper.
- Competitors present: tick chips for the reference list (Monster, V, Solo Energy, Rockstar, Celsius) plus **Add competitor** for any other brand (free text, de-duplicated case-insensitively). Any number of competitors.
- One card per competitor: front facings, price (optional, above $0 and under $20), and for stores (not vending) **POS pieces in store** and **coolers/fridges in store**. Remove button on each card.
- Live **Red Bull share of shelf** = Red Bull facings ÷ (Red Bull + all competitor facings).
- Competitors from the last audit are pre-ticked (facings reset to 0; price, POS, coolers prefill).
- Red Bull price; for stores: Red Bull POS present, Red Bull cooler present, Bullring/Bull's Eye, channel, classification; for vending: vending company, machine ID, V and Monster SKU counts and prices.
- Top competitor and competitor price are **derived** on submit (competitor with most facings) for older reports. *Prototype:* `withTopComp`.

**BR-33 Step 4 — Outcomes.** DPs added, DPs lost (net shown), Editions sold in (+ flavours), POS placed (+ type, required if > 0), coolers installed / removed (stores only).
**BR-34 Step 5 — Notes & follow-up.** Notes ("Contact details go in step 1, not here"), next step, follow-up date (≥ visit date), photos (up to 6; prototype keeps them for the session only), flag an issue (+ description required).
**BR-35 Step 6 — Review & submit.** Lists every validation problem with a link to its step; shows the next due date; Submit.
**BR-36 Drafts.** Save as Draft at any step; leaving with unsaved changes asks to keep editing, save draft, or leave.
**BR-37 On submit.** Visit saved with an ID `CODE-V0001-xxxx`; location updated with the latest ranging, prices, execution, facings, competitor detail and contact (blank phone/email keep existing values); Managers of the state notified; approval set (see BR-40).

## E. Approval, leaderboard and months

**BR-40 Approval.** In "Manager approval" mode, new Completed audits are *Pending* until a Manager/Admin of that state marks them Approved, Rejected (reason) or Duplicate (of which audit). In "Count on submit" mode they are Approved immediately. Rejections and duplicates notify the SM. Nobody approves their own audit. *Prototype:* `ReviewQueue`, `decide`.

**BR-41 What counts.** Only Completed + Approved + named SM + not imported audits count for scores. Imported workbook history sets due dates only.

**BR-42 Monthly score (0–100).** Measures and default weights: Ranging % 30, TDP added 25, Editions sold 20, POS placed 15, Coolers added 10 (weights must total 100). Ranging % = average across locations (latest approved audit per location in the month) of Red Bull SKUs ranged ÷ Red Bull SKUs that apply. Other measures are normalised **relative to the month's leader** (leader = 100) or **against monthly targets** (TDP 12, Editions 8, POS 10, Coolers 2; capped at 100). Minimum **3 approved audits** to be ranked. Ties broken by TDP, ranging, audits, earliest last approval, name. *Prototype:* `scoreMonth`, `MEASURES`.

**BR-43 Monthly reset.** On the first load after a month ends, the old month becomes an *In review* snapshot and the new month starts at zero. Nothing is deleted. *Prototype:* `rollMonths`.

**BR-44 Finalise.** An Administrator finalises a month (step-up). The snapshot locks rows, ranks and the rules used. Later edits to that month are logged corrections that do not change the locked board.

**BR-45 Distribute results.** Administrator sends results to chosen groups (Education Channel Leads, Administrators, SMs, extra recipients) by method (Email and in-app / Email only / In-app only / Teams post and in-app), with a message template (`{first}`, `{second}`, `{third}`, `{month}`, `{ranked}`). Target: by business day 3. Names, ranks and scores only.

## F. Notifications and reporting

**BR-50 Per-audit alert** to the state's Managers when an audit is completed.
**BR-51 Removal requests** go to the state's Education Channel Lead(s) to approve (location/institution removed) or reject, with a note back to the requester.
**BR-52 Daily summary:** one per SM per day with ≥ 2 completed audits, to the state's Leads and Managers, dated 18:00 (the Daily summary time setting only changes the "Scheduled" label in the Email log in the prototype): audits, institutions, stores, vending, key findings (net DPs, Editions, POS, coolers, issues).
**BR-53 Monthly state summary** to each state's Managers and Education Channel Lead(s), and **national breakdown** to all Administrators, in the inbox on the **1st of the next month 08:00**. Contents: audits, coverage (active locations visited ÷ active locations), net DPs, Editions, POS, coolers placed, share of shelf, Red Bull ranging (audited locations), competitor POS and coolers seen, highlights, leaderboard top 3, tables by institution and SM (state) or by state (national), Excel download. Six months listed: the current month (month to date) and the previous five; only closed months create inbox notices. *Prototype:* `stateMonthly`, `nationalMonthly`, `MonthlySummaries`, `MonthlyView`, `monthlyWorkbook`.
**BR-54 Monthly audit export** generated on the **last calendar day of each month (18:00)**: Administrators get all states (and can pick one state); Managers get their own state. Notification "Audit export ready". Workbook sheets: **Dashboard** (8 KPI tiles with change vs previous month, key points, 9 native bar charts), **Summary** (one row per state, plus an "All states" total row when more than one state is exported), **one sheet per state** listing every audit record (61 columns, including scheduled, cancelled, rejected and duplicate, with a *Counted* flag), **Chart data**. Last 12 months listed; current month offers "Month to date". *Prototype:* `AuditExports`, `auditExportWorkbook`, `exportDashboard`.
**BR-55 Dashboard charts** (state scope switches the first four to "by university & TAFE"): audits completed by state; coverage by state; Editions/POS/coolers by state; share of shelf by state; share of front facings by brand (Red Bull highlighted navy); audits last 6 months; Editions/POS/coolers last 6 months; top 10 institutions by audits; top 10 SMs by audits.
**BR-56 Progress screen** (filters: state, institution kind, institution, location type, date range): KPIs, by state (Admin national), by institution, required vs completed, status mix, monthly completion trend, SM reporting, and **Execution**: Editions, POS, coolers placed (with ▲/▼ vs previous period), share of shelf, Red Bull ranging (current, checked SKUs only), running-totals chart, share-of-shelf bar by brand with competitor table, breakdown table. Download Excel (Summary, By state, By institution, Execution, Student Marketeers, Locations) and Copy CSV. *Prototype:* `Progress`, `ExecSection`, `execStats`.

## G. Audit trail

**BR-60** Every create/edit/approval/score rule change/role change/finalise/distribute/sign-in is written to the audit log with user, time, target, detail and before/after values. Entries cannot be edited or deleted. Sign-ins and refusals are listed separately (Settings → Sign-in log).

## H. Non-functional

**BR-70** Mobile-first; no horizontal scroll at 375 px; bottom navigation on phones, left rail ≥ 1024 px.
**BR-71** Audit completable in under 2 minutes (prefill from last audit, steppers, chips).
**BR-72** Accessible: labelled inputs, visible focus, status = colour + icon + text, 40 px+ targets, reduced-motion respected.
**BR-73** Shared live data for all users; no data loss when two people edit (IDs never depend on local counts).
**BR-74** Dates and month boundaries use the device's local date (production: Australia/Sydney or the user's state time zone — decision open, see `13-known-issues.md`).
