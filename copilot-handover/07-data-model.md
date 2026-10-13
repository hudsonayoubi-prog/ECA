# 07 · Data model

## Part A — Prototype records (state object `s`)

All records are plain JSON. Keys used for shared storage are in brackets. Optional fields may be absent or `null`.

### `states[]` (in config)
`{ code: 'VIC', name: 'Victoria' }` — VIC, NSW, QLD, SA, WA.

### `unis[]` — universities and TAFEs [key `code`]
| Field | Type | Notes |
|---|---|---|
| code | string 2–6 A–Z | Unique; location ID prefix (MON, UWA, TNSW…) |
| name / short | string | Full and short display names |
| kind | 'University' \| 'TAFE' | Drives navy/yellow tag and filters |
| state | state code | One state per record (multi-state institutions are split) |
| campuses | string[] | May be empty |
| status | 'Active' \| 'Removed' | |
| note | string? | e.g. UTAS "Placed under VIC until Tasmania is set up" |
| logo | data URL? | Uploaded logo, ≤ 160 px WebP/PNG |

### `locations[]` — stores and vending machines [key `id`]
| Group | Fields |
|---|---|
| Identity | `id` (MON-012 / MON-VM-012), `uni`, `campus`, `name`, `type` ('QSR' \| 'Vending'), `storeType` (QSR, Vending, Student Bar, Convenience, NKA; absent = auto-guess "to confirm"), `status` ('Active' \| 'Inactive' \| 'Removed'), `removedNote`, `added` (date), `addedBy`, `cycle` (days) |
| Address | `address`, `landmark`, `building`, `level`, `postcode` |
| Latest audit picture | `ranging` {productKey: 1/0/null}, `pos` (1/0), `cooler` (1/0), `price`, `topComp`, `compPrice`, `bull` (EYE/RING), `channel` (OnP/OffP), `classification` (A–D), `indNka`, `pic` (Red Bull owner), `notes` (latest next step) |
| Vending | `vendCo`, `machineId`, `vSku`, `vPrice`, `mSku`, `mPrice` |
| Contact | `contact` (legacy masked "F•••"), `contactName`, `contactRole`, `contactPhone`, `contactEmail`, `contactAt` (date), `contactBy` |
| Facings | `rbFacings` (int), `compFacings` {brand: int}, `compDetail` {brand: {price: number\|null, pos: int, coolers: int}}, `facingComps` (string[] ticked last time), `facingsAt` (date) |
| Derived at runtime (not stored) | `locStatus`, `status` (visit status), `last`, `due`, `days`, `uniName`, `state`, `kind`, `lastBy`, `visits` |

### `visits[]` — audits and other visits [key `id`]
| Group | Fields |
|---|---|
| Identity | `id` (`MON-V0007-k3fz`), `uni`, `loc`, `date` (YYYY-MM-DD), `time` (HH:MM), `staff` (name), `staffId`, `status` ('Completed' \| 'Scheduled' \| 'Cancelled') |
| Contact | `contactName`, `contactRole` (phone/email are stored on the location only) |
| Outcomes | `dpAdded`, `dpLost`, `editions`, `flavours`, `posPlaced`, `posType`, `coolersIn`, `coolersOut` |
| Facings (Completed only, else null) | `rbFacings`, `compFacings` {brand: int}, `compDetail` {brand: {price, pos, coolers}}, `compPos`, `compCoolers` |
| Response (Completed only) | `response` = { `ranging`, `price`, `comp` (derived top competitor), `compPrice`, `pos`, `cooler`, `bull`, `channel`, `classification`, `vendCo`, `machineId`, `vSku`, `vPrice`, `mSku`, `mPrice`, and for store audits `placement`, `visibility`, `activation` (1/0), `buySource` ('Distributor' \| 'Retail' \| 'Not sure'), `distributor`, `visTools` [] } |
| Hi5 (Completed store audits, else null) | `hi5` = { `availability`, `placement`, `visibility`, `activation`, `win` }, each 1, 0 or null. Availability = ED and (SF or Zero) and Editions ranged; activation = answered Yes and Red Bull price > 0; win = Red Bull facings > top competitor facings |
| Notes | `notes`, `nextStep`, `followUp`, `issue` (text or null), `photos` (count) |
| Approval | `approval` ('Pending' \| 'Approved' \| 'Rejected' \| 'Duplicate'; absent = Approved), `approvedBy`, `approvedAt`, `rejectReason`, `dupOf` |
| Audit | `submittedAt`, `submittedBy`, `imported` (workbook history), `demo` (prototype demo only). A correction reason for edits in a finalised month is written to the audit log (category Correction), not the visit |

### `people[]` [key `id`]
`{ id: 'p-hudson-ayoubi', name, role: 'admin'|'manager'|'marketeer', state (null for admins), status: 'Active'|'Inactive', reportsTo (manager name), disambig?, aliases? [] }`

### `leads` (in config)
`{ VIC: ['Keane Vivas'], NSW: ['Makenzie Grant','Sophie Ness'], QLD: ['Holiday Chen'], SA: ['Connor Mahon'], WA: ['Rachel Sullivan','Georgia Merret'] }` — Education Channel Leads (Administrators).

### `ref` (in config) — reference values
See `DEFAULT_REF` and `project/config/reference-values.json`: products (key, label, short, qsr, vending, competitor), visitStatuses, posTypes, competitors, contactRoles, channels, classifications, bull, indNka, vendingCompanies, removalReasons, defaultCycle 14, dueSoonDays 3, reminderLeadDays 3, notifyOverdue, dailySummaryTime '18:00', storeTypes [{name, active}], scoring {weights, method, targets, minAudits}, approvalMode 'manager'|'auto', adminPin, results {groups, extra, method, businessDay, template}.

### `snapshots[]` — leaderboard months [key `month`]
`{ month: '2026-09', status: 'In review'|'Final', rows: [{ id, name, state, reportsTo, audits, locations, ranging, tdp, editions, pos, coolers, scores{}, points{}, total, rank, qualified }], createdAt, finalisedAt, finalisedBy, rules (scoring copy), excludedPending, distributed: { generatedAt, distributedAt, by, groups[], method, count, message } }`

### `requests[]` — removal requests [key `id`]
`{ id: 'RR-0001-x9a', status: 'Pending'|'Approved'|'Rejected', submittedAt, requester, state, targetType ('Store'|'Vending machine'|'University'|'TAFE'), targetId, targetName, reason, comments, decidedBy, decidedAt, decisionNote }`

### `notifications[]` (append-only, max 400)
`{ id, ts, kind ('audit'|'request'|'decision'|'results'…), to: [names], state, title, body, ref: {route}, email: bool, reqId? }`. Daily summaries, reminders, monthly summaries and export notices are computed, not stored.

### `log[]` (append-only, max 3000) and `logins[]` (max 1000)
Log: `{ ts, user, action, target, detail, cat ('Login','Activity','Approval','Correction','Score','Leaderboard','Distribution','People','Locations','Settings'), from, to }`. Logins: `{ ts, name, id, role, result ('Signed in' | 'Not on approved list' | 'Account deactivated' | 'Wrong admin PIN') }`.

### Per-browser only
`drafts[]` (audit form snapshots), `readKeys` {key|name: 1}, `demo[]` (demo leaderboard audits, same shape as visits + `demo: true`), `me`, `meId`, `authed`, `elevatedUntil`, `route`, `rosterRev`, `ecaRev`, `lastMonth`.

### Audit form (`f`, not stored except as drafts)
All visit fields plus `uni`, `campus`, `loc`, `date` (datetime-local), `ranging`, `price`, `comp`, `compPrice`, `pos`, `cooler`, `bull`, `channel`, `classification`, vending fields, `rbFacings`, `compFacings`, `compDetail` {brand: {price: string, pos, coolers}}, `contactName/Role/Phone/Email`, `_onFile` {phone, email}, `_prefilled`, `issue` (bool) + `issueNote`, `photos` (data URLs, session only), `editingId`, `reason`, `draftId`.

### Calculated measures (definitions used everywhere)
| Measure | Definition | Code |
|---|---|---|
| Location status | see BR-21 | `locationStatus` |
| Completion / coverage | active locations with ≥ 1 Completed visit in the period ÷ active locations | `summarise`, `monthStats` |
| Net DPs | Σ dpAdded − Σ dpLost | |
| Share of shelf | Σ Red Bull facings ÷ Σ (Red Bull + competitor facings), using each location's latest visit in the period that recorded facings | `execStats`, `shelfShare` |
| Red Bull ranging (current) | average over active locations of ranged ÷ checked Red Bull SKUs (unchecked ignored) | `rbRangePct`, `execStats.rangingNow` |
| Red Bull ranging (audited) | same, from the latest audit per location in the month | `execStats.rangingAudited` |
| Leaderboard ranging % | latest approved audit per location in month: ranged ÷ applicable Red Bull SKUs | `scoreMonth` |
| Counted audit | Completed and approval not Rejected/Duplicate (exports, summaries); leaderboard additionally requires Approved, named SM, not imported | |

---

## Part B — Dataverse schema (production)

Generated from `project/docs/power-platform/ECA_Dataverse_Build_Pack.xlsx` ("Tables & columns"). Publisher prefix `eca_`. Choice sets are on the "Choices" sheet; import-ready data sheets 1–13 follow the import order on "Read me".


> **Added 13 Oct 2026 (Hi5):** nine columns on Audit Visit and six on Location, listed in `docs/power-platform/schema/extensions.json` and merged by `scripts/pp_schema.py` (253 columns in total). They hold the Hi5 answers and results, where Red Bull is bought from, the distributor and the additional visibility tools.

### State (`eca_state`)
One row per state. Business Unit of the same name owns the state’s records.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| State Code | `eca_name` | Text (10) · Primary name | Required | VIC, NSW, QLD, SA, WA |
| State Name | `eca_statename` | Text (100) | Required |  |

### Store Location Type (`eca_storelocationtype`)
Admin-managed dropdown for every audit location.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Name | `eca_name` | Text (100) · Primary name | Required | QSR, Vending, Student Bar, Convenience, NKA |
| Active | `eca_active` | Yes/No | Required | Default Yes; No = hidden from new records, kept on history |
| Uses Vending Fields | `eca_usesvendingfields` | Yes/No | Required | Default No; Yes for Vending: form shows machine fields |
| Sort Order | `eca_sortorder` | Whole number | Optional |  |

### ECA User (`eca_ecauser`)
The approved user list. Every audit, approval and score points at this table by ID, never by name.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Full Name | `eca_name` | Text (200) · Primary name | Required | Display name, e.g. Charlotte Terrell |
| First Name | `eca_firstname` | Text (100) | Required |  |
| Last Name | `eca_lastname` | Text (100) | Required |  |
| Normalised Name | `eca_normalisedname` | Text (200) | Optional | Set by flow / Power Fx on save; lower case, no accents, hyphens and apostrophes as spaces; used for name sign-in |
| Aliases | `eca_aliases` | Text (400) | Optional | Comma separated other names, e.g. preferred first name |
| Disambiguation Label | `eca_disambiguation` | Text (100) | Optional | Required when two users share a name |
| Role | `eca_role` | Choice: ECA Role | Required |  |
| State | `eca_state` | Lookup → State | Optional | Blank for national Administrators |
| Reports To | `eca_reportsto` | Lookup → ECA User | Optional | Student Marketeers → their Manager |
| Status | `eca_status` | Choice: Active / Inactive | Required | Default Active |
| Email | `eca_email` | Email (200) | Optional | Red Bull email. Needed for Microsoft sign-in and for results emails |
| Entra User | `eca_systemuser` | Lookup → User (systemuser) | Optional | Links the record to the person’s Microsoft account |
| Last Sign-in | `eca_lastsignin` | Date and time | Optional |  |

### Channel Lead (`eca_channellead`)
Education Channel Leads per state: approve removals, finalise and send results.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Name | `eca_name` | Text (200) · Primary name | Required | e.g. VIC – Keane Vivas |
| Lead | `eca_lead` | Lookup → ECA User | Required |  |
| State | `eca_state` | Lookup → State | Required |  |

### Institution (`eca_institution`)
Universities and TAFEs.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Code | `eca_name` | Text (10) · Primary name | Required | MON, RMIT … also the Location ID prefix |
| Institution Name | `eca_institutionname` | Text (200) | Required |  |
| Short Name | `eca_shortname` | Text (60) | Optional |  |
| Kind | `eca_kind` | Choice: University / TAFE | Required |  |
| State | `eca_state` | Lookup → State | Required |  |
| Status | `eca_status` | Choice: Active / Removed | Required | Default Active |
| Note | `eca_note` | Text (400) | Optional |  |
| Logo | `eca_logo` | Image | Optional | Official logo file uploaded by an Admin or Manager; tiles show the code when blank |

### Campus (`eca_campus`)


| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Campus Key | `eca_name` | Text (120) · Primary name | Required | Institution code + campus, e.g. MON – Clayton (unique, used by imports) |
| Campus Name | `eca_campusname` | Text (100) | Required |  |
| Institution | `eca_institution` | Lookup → Institution | Required |  |

### Location (`eca_location`)
Every QSR store and vending machine.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Location ID | `eca_name` | Text (20) · Primary name | Required | Alternate key; MON-012 (store) or MON-VM-012 (vending). Never reused |
| Location Name | `eca_locationname` | Text (200) | Required |  |
| Institution | `eca_institution` | Lookup → Institution | Required |  |
| Campus | `eca_campus` | Lookup → Campus | Required |  |
| Store Location Type | `eca_storelocationtype` | Lookup → Store Location Type | Required |  |
| Type Confirmed | `eca_typeconfirmed` | Yes/No | Required | Default No; No = classified automatically from the workbook |
| Status | `eca_status` | Choice: Active / Paused / Removed | Required | Default Active |
| Date Added | `eca_dateadded` | Date only | Required |  |
| Visit Cycle (days) | `eca_visitcycledays` | Whole number 1–365 | Required | Default 14 |
| Address | `eca_address` | Text (300) | Optional |  |
| Postcode | `eca_postcode` | Text (10) | Optional |  |
| Landmark | `eca_landmark` | Text (200) | Optional |  |
| Building | `eca_building` | Text (100) | Optional |  |
| Level | `eca_level` | Text (50) | Optional |  |
| Ranged: Energy Drink | `eca_rg_ed` | Choice: Yes / No (blank = not checked) | Optional | Red Bull SKU, scores ranging % |
| Ranged: Sugarfree | `eca_rg_sf` | Choice: Yes / No (blank = not checked) | Optional | Red Bull SKU, scores ranging % |
| Ranged: Zero | `eca_rg_zero` | Choice: Yes / No (blank = not checked) | Optional | Red Bull SKU, scores ranging % |
| Ranged: Editions | `eca_rg_editions` | Choice: Yes / No (blank = not checked) | Optional | Red Bull SKU, scores ranging % |
| Ranged: Monster | `eca_rg_monster` | Choice: Yes / No (blank = not checked) | Optional | Competitor |
| Ranged: Monster Ultra | `eca_rg_monsterultra` | Choice: Yes / No (blank = not checked) | Optional | Competitor |
| Ranged: V | `eca_rg_v` | Choice: Yes / No (blank = not checked) | Optional | Competitor |
| Ranged: V Sugarfree | `eca_rg_vsf` | Choice: Yes / No (blank = not checked) | Optional | Competitor |
| Ranged: V Blue | `eca_rg_vblue` | Choice: Yes / No (blank = not checked) | Optional | Competitor |
| Ranged: Solo Energy | `eca_rg_solo` | Choice: Yes / No (blank = not checked) | Optional | Competitor |
| POS Present | `eca_pospresent` | Choice: Yes / No | Optional |  |
| Cooler Present | `eca_coolerpresent` | Choice: Yes / No | Optional |  |
| Red Bull Price | `eca_redbullprice` | Currency | Optional |  |
| Top Competitor | `eca_topcompetitor` | Text (100) | Optional |  |
| Competitor Price | `eca_competitorprice` | Currency | Optional |  |
| Bullring or Bull’s Eye | `eca_bull` | Choice: EYE / RING | Optional |  |
| Channel | `eca_channel` | Choice: OnP / OffP | Optional |  |
| Classification | `eca_classification` | Choice: A / B / C / D | Optional |  |
| IND or NKA | `eca_indnka` | Choice: IND / NKA | Optional |  |
| Red Bull Owner | `eca_redbullowner` | Text (100) | Optional |  |
| Store Contact (legacy) | `eca_storecontact` | Text (200) | Optional | Column security: Managers and Admins only; Masked value from the workbook; superseded by the four contact columns |
| Contact Name | `eca_contactname` | Text (200) | Optional | Set from the latest audit; Person spoken to; visible to everyone in the state |
| Contact Role | `eca_contactrole` | Choice: ECA Contact Role | Optional | Set from the latest audit |
| Contact Phone | `eca_contactphone` | Phone (30) | Optional | Column security: Managers and Admins read; Student Marketeers write only; Kept if an audit leaves it blank |
| Contact Email | `eca_contactemail` | Email (200) | Optional | Column security: Managers and Admins read; Student Marketeers write only; Kept if an audit leaves it blank |
| Contact Recorded On | `eca_contactrecordedon` | Date only | Optional |  |
| Contact Recorded By | `eca_contactrecordedby` | Lookup → ECA User | Optional |  |
| Red Bull Front Facings | `eca_rbfacings` | Whole number ≥ 0 | Optional | Set from the latest completed audit |
| Facings Recorded On | `eca_facingsrecordedon` | Date only | Optional |  |
| Vending Company | `eca_vendingcompany` | Text (100) | Optional |  |
| Machine ID | `eca_machineid` | Text (50) | Optional |  |
| V SKU Count | `eca_vskucount` | Whole number | Optional |  |
| V Price | `eca_vprice` | Currency | Optional |  |
| Monster SKU Count | `eca_monsterskucount` | Whole number | Optional |  |
| Monster Price | `eca_monsterprice` | Currency | Optional |  |
| Latest Note | `eca_latestnote` | Multiline text (2000) | Optional |  |
| Last Completed Visit | `eca_lastcompletedvisit` | Date only | Optional | Set by flow on approved/complete visit |
| Next Due | `eca_nextdue` | Date only | Optional | Formula column: Last Completed Visit (or Date Added) + Visit Cycle |

### Allocation (`eca_allocation`)
Who usually covers which campus (guidance, not a lock).

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Name | `eca_name` | Text (200) · Primary name | Required | Person – Institution – Campus |
| Staff Member | `eca_staffmember` | Lookup → ECA User | Required |  |
| Institution | `eca_institution` | Lookup → Institution | Required |  |
| Campus | `eca_campustext` | Text (100) | Optional | “All” or a campus name |
| Status | `eca_status` | Choice: Active / Inactive | Required |  |

### Competitor (`eca_competitor`)
Competitor brands for front facings and competitor execution.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Name | `eca_name` | Text (100) · Primary name | Required | Monster, V, Solo Energy, Rockstar, Celsius, plus any added in the field |
| Active | `eca_active` | Yes/No | Required | Default Yes; Active ones show as tick chips in audit step 3 |
| Added From Field | `eca_addedfromfield` | Yes/No | Optional | Default No; Yes = typed in by a Student Marketeer via Add competitor; Admin to review |

### Location Competitor (`eca_locationcompetitor`)
Latest competitor picture per location (replaced on every completed audit). Pre-ticks competitors at the next audit.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Name | `eca_name` | Text (200) · Primary name | Required | Location ID – competitor |
| Location | `eca_location` | Lookup → Location | Required |  |
| Competitor | `eca_competitor` | Lookup → Competitor | Required |  |
| Front Facings | `eca_facings` | Whole number ≥ 0 | Required |  |
| Price | `eca_price` | Currency | Optional |  |
| POS Pieces | `eca_pospieces` | Whole number ≥ 0 | Optional | Stores only, not vending |
| Coolers | `eca_coolers` | Whole number ≥ 0 | Optional | Stores only, not vending |

### Audit Visit (`eca_auditvisit`)
Every visit. Only Completed + Approved + named Student Marketeer + not imported counts on the leaderboard.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Visit ID | `eca_name` | Autonumber or text · Primary name | Required | e.g. MON-V0001 |
| Location | `eca_location` | Lookup → Location | Required |  |
| Institution | `eca_institution` | Lookup → Institution | Required |  |
| Visit Date | `eca_visitdate` | Date only | Required |  |
| Visit Time | `eca_visittime` | Text (5) | Optional | HH:MM local |
| Staff Member | `eca_staffmember` | Lookup → ECA User | Optional | Blank only on imported history |
| Visit Status | `eca_visitstatus` | Choice: Completed / Scheduled / Cancelled | Required |  |
| Approval Status | `eca_approvalstatus` | Choice: Pending / Approved / Rejected / Duplicate | Optional | Completed visits only |
| Approved By | `eca_approvedby` | Lookup → ECA User | Optional |  |
| Approved On | `eca_approvedon` | Date and time | Optional |  |
| Reject Reason | `eca_rejectreason` | Text (400) | Optional |  |
| Duplicate Of | `eca_duplicateof` | Lookup → Audit Visit | Optional |  |
| Reporting Month | `eca_reportingmonth` | Text (7) | Optional | Formula column; YYYY-MM from Visit Date |
| DPs Added | `eca_dpsadded` | Whole number ≥ 0 | Required | Default 0 |
| DPs Lost | `eca_dpslost` | Whole number ≥ 0 | Required | Default 0 |
| Editions Sold In | `eca_editionssold` | Whole number ≥ 0 | Required | Default 0 |
| Edition Flavours | `eca_editionflavours` | Text (200) | Optional |  |
| POS Placed | `eca_posplaced` | Whole number ≥ 0 | Required | Default 0 |
| POS Type | `eca_postype` | Choice: ECA POS Type | Optional |  |
| Coolers Installed | `eca_coolersin` | Whole number ≥ 0 | Required | Default 0 |
| Coolers Removed | `eca_coolersout` | Whole number ≥ 0 | Required | Default 0 |
| Ranging Answers | `eca_rangingjson` | Multiline text | Optional | JSON of Yes/No per SKU on this visit (used for ranging %) |
| Ranging % | `eca_rangingpct` | Decimal 0–100 | Optional | Set by app on submit; Red Bull SKUs ranged ÷ applicable |
| Notes | `eca_notes` | Multiline text (4000) | Optional |  |
| Next Step | `eca_nextstep` | Text (400) | Optional |  |
| Follow-up Date | `eca_followup` | Date only | Optional |  |
| Issue | `eca_issue` | Text (400) | Optional |  |
| Photo Count | `eca_photocount` | Whole number | Optional | Photos stored as Notes/attachments or a File column |
| Imported | `eca_imported` | Yes/No | Required | Default No; Yes = history from the workbook, never scores |
| Correction Reason | `eca_correctionreason` | Text (400) | Optional | Required when edited after the month is final |
| Contact Name | `eca_contactname` | Text (200) | Optional | Required for Completed visits; Who the Student Marketeer spoke to (step 1) |
| Contact Role | `eca_contactrole` | Choice: ECA Contact Role | Optional |  |
| Red Bull Price | `eca_redbullprice` | Currency | Optional |  |
| Top Competitor | `eca_topcompetitor` | Text (100) | Optional | Set by app; Competitor with most facings; kept for older reports |
| Competitor Price | `eca_competitorprice` | Currency | Optional | Set by app; Price of the top competitor |
| Red Bull POS Present | `eca_rbpospresent` | Choice: Yes / No | Optional |  |
| Red Bull Cooler Present | `eca_rbcoolerpresent` | Choice: Yes / No | Optional |  |
| Red Bull Front Facings | `eca_rbfacings` | Whole number ≥ 0 | Optional | Completed visits only |
| Competitor Front Facings | `eca_compfacings` | Whole number ≥ 0 | Optional | Rollup: sum of Visit Competitor facings |
| Share of Shelf % | `eca_shareofshelf` | Decimal 0–100 | Optional | Formula: Red Bull ÷ (Red Bull + competitor) facings |
| Competitor POS Seen | `eca_comppos` | Whole number | Optional | Rollup: sum of Visit Competitor POS |
| Competitor Coolers Seen | `eca_compcoolers` | Whole number | Optional | Rollup: sum of Visit Competitor coolers |

### Visit Competitor (`eca_visitcompetitor`)
One row per competitor recorded on an audit (step 3). Any number per visit.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Name | `eca_name` | Text (200) · Primary name | Required | Visit ID – competitor |
| Audit Visit | `eca_auditvisit` | Lookup → Audit Visit | Required | Parental (cascade delete) |
| Competitor | `eca_competitor` | Lookup → Competitor | Required |  |
| Front Facings | `eca_facings` | Whole number ≥ 0 | Required | Default 0 |
| Price | `eca_price` | Currency | Optional |  |
| POS Pieces | `eca_pospieces` | Whole number ≥ 0 | Optional | Default 0; Stores only |
| Coolers | `eca_coolers` | Whole number ≥ 0 | Optional | Default 0; Stores only |

### Monthly Report (`eca_monthlyreport`)
Optional in production: Power Automate writes one row per generated report so the Notifications screen can list and download them.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Name | `eca_name` | Text (100) · Primary name | Required | e.g. 2026-09 · VIC · State summary |
| Month | `eca_month` | Text (7) | Required | YYYY-MM |
| Report Type | `eca_reporttype` | Choice: State summary / National breakdown / Audit export | Required |  |
| State | `eca_state` | Lookup → State | Optional | Blank = all states |
| Generated On | `eca_generatedon` | Date and time | Required | Summaries: 1st of next month 08:00. Audit export: last calendar day 18:00 |
| File | `eca_file` | File (Excel) | Optional | The generated .xlsx (audit export includes the Dashboard sheet with charts) |
| Recipients | `eca_recipients` | Text (2000) | Optional | Managers + Channel Leads for state reports; Administrators for national |

### Scoring Rule Set (`eca_scoringruleset`)
Weights must total 100. A new row per change; snapshots point at the row they used.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Name | `eca_name` | Text (100) · Primary name | Required |  |
| Effective From | `eca_effectivefrom` | Date only | Required |  |
| Weight Ranging | `eca_wranging` | Whole number 0–100 | Required |  |
| Weight TDP | `eca_wtdp` | Whole number 0–100 | Required |  |
| Weight Editions | `eca_weditions` | Whole number 0–100 | Required |  |
| Weight POS | `eca_wpos` | Whole number 0–100 | Required |  |
| Weight Coolers | `eca_wcoolers` | Whole number 0–100 | Required |  |
| Normalisation | `eca_normalisation` | Choice: Relative to leader / Against targets | Required |  |
| Target TDP | `eca_ttdp` | Whole number | Optional |  |
| Target Editions | `eca_teditions` | Whole number | Optional |  |
| Target POS | `eca_tpos` | Whole number | Optional |  |
| Target Coolers | `eca_tcoolers` | Whole number | Optional |  |
| Minimum Approved Audits | `eca_minaudits` | Whole number ≥ 1 | Required |  |
| Approval Mode | `eca_approvalmode` | Choice: Manager approval / Count on submit | Required |  |
| Is Current | `eca_iscurrent` | Yes/No | Required |  |

### Leaderboard Snapshot (`eca_leaderboardsnapshot`)
Created at month end by flow; locked when Final.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Month | `eca_name` | Text (7) · Primary name | Required | Alternate key; YYYY-MM |
| Status | `eca_status` | Choice: In review / Final | Required |  |
| Created On | `eca_snapshotcreated` | Date and time | Required |  |
| Finalised By | `eca_finalisedby` | Lookup → ECA User | Optional |  |
| Finalised On | `eca_finalisedon` | Date and time | Optional |  |
| Rule Set | `eca_ruleset` | Lookup → Scoring Rule Set | Required |  |
| Unapproved Audits Excluded | `eca_excludedpending` | Whole number | Optional |  |

### Snapshot Row (`eca_snapshotrow`)


| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Name | `eca_name` | Text (200) · Primary name | Required | Month – person |
| Snapshot | `eca_snapshot` | Lookup → Leaderboard Snapshot | Required |  |
| Student Marketeer | `eca_user` | Lookup → ECA User | Required |  |
| Rank | `eca_rank` | Whole number | Optional | Blank = not ranked |
| Total Score | `eca_totalscore` | Decimal (1 dp) | Optional |  |
| Qualified | `eca_qualified` | Yes/No | Optional |  |
| Approved Audits | `eca_audits` | Whole number | Optional |  |
| Ranging % | `eca_rangingpct` | Decimal | Optional |  |
| TDP Added | `eca_tdp` | Whole number | Optional |  |
| Editions Sold | `eca_editions` | Whole number | Optional |  |
| POS Placed | `eca_pos` | Whole number | Optional |  |
| Coolers Added | `eca_coolers` | Whole number | Optional |  |
| Score Ranging | `eca_sranging` | Decimal | Optional |  |
| Score TDP | `eca_stdp` | Decimal | Optional |  |
| Score Editions | `eca_seditions` | Decimal | Optional |  |
| Score POS | `eca_spos` | Decimal | Optional |  |
| Score Coolers | `eca_scoolers` | Decimal | Optional |  |

### Results Distribution (`eca_resultsdistribution`)


| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Name | `eca_name` | Text (100) · Primary name | Required |  |
| Snapshot | `eca_snapshot` | Lookup → Leaderboard Snapshot | Required |  |
| Generated On | `eca_generatedon` | Date and time | Optional |  |
| Distributed On | `eca_distributedon` | Date and time | Optional |  |
| Distributed By | `eca_distributedby` | Lookup → ECA User | Optional |  |
| Groups | `eca_groups` | Text (300) | Optional |  |
| Method | `eca_method` | Choice: Email and in-app / Email only / In-app only / Teams post and in-app | Optional |  |
| Message | `eca_message` | Multiline text (4000) | Optional |  |
| Recipient Count | `eca_recipientcount` | Whole number | Optional |  |

### Distribution Settings (`eca_distributionsettings`)


| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Name | `eca_name` | Text (100) · Primary name | Required | Single row: “Default” |
| Send to Channel Leads | `eca_toleads` | Yes/No | Optional |  |
| Send to Administrators | `eca_toadmins` | Yes/No | Optional |  |
| Send to Student Marketeers | `eca_tosms` | Yes/No | Optional |  |
| Additional Recipients | `eca_extra` | Text (1000) | Optional | Emails, semicolon separated |
| Method | `eca_method` | Choice (as Results Distribution) | Optional |  |
| Send By Business Day | `eca_businessday` | Whole number 1–10 | Optional |  |
| Message Template | `eca_template` | Multiline text (2000) | Optional |  |

### Removal Request (`eca_removalrequest`)


| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Request ID | `eca_name` | Autonumber RR-{SEQNUM:4} · Primary name | Required |  |
| Target Type | `eca_targettype` | Choice: Store / Vending machine / University / TAFE | Optional |  |
| Location | `eca_location` | Lookup → Location | Optional |  |
| Institution | `eca_institution` | Lookup → Institution | Optional |  |
| State | `eca_state` | Lookup → State | Optional |  |
| Requested By | `eca_requestedby` | Lookup → ECA User | Optional |  |
| Reason | `eca_reason` | Choice: ECA Removal Reason | Optional |  |
| Comments | `eca_comments` | Text (1000) | Optional |  |
| Status | `eca_status` | Choice: Pending / Approved / Rejected | Optional |  |
| Decided By | `eca_decidedby` | Lookup → ECA User | Optional |  |
| Decided On | `eca_decidedon` | Date and time | Optional |  |
| Decision Note | `eca_decisionnote` | Text (400) | Optional |  |

### Sign-in Event (`eca_signinevent`)
Only needed if the name sign-in fallback is used; Microsoft sign-in is logged by Entra ID.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Name | `eca_name` | Text (200) · Primary name | Required | Name entered |
| Matched User | `eca_user` | Lookup → ECA User | Optional |  |
| Result | `eca_result` | Choice: Signed in / Not on list / Deactivated / Wrong admin PIN / Locked out | Optional |  |
| Signed In On | `eca_signedinon` | Date and time | Optional |  |
| Device | `eca_device` | Text (200) | Optional |  |

### ECA Audit Log (`eca_auditlog`)
Append-only: every security role gets Create + Read only. Turn on Dataverse auditing as well.

| Column | Logical name | Type | Required | Behaviour / notes |
|---|---|---|---|---|
| Action | `eca_name` | Text (200) · Primary name | Required |  |
| Category | `eca_category` | Choice: Log Category | Optional |  |
| User | `eca_user` | Lookup → ECA User | Optional |  |
| Logged On | `eca_loggedon` | Date and time | Optional |  |
| Table | `eca_tablename` | Text (100) | Optional |  |
| Record | `eca_recordid` | Text (100) | Optional |  |
| Previous Value | `eca_previousvalue` | Multiline text (2000) | Optional |  |
| New Value | `eca_newvalue` | Multiline text (2000) | Optional |  |
| Detail | `eca_detail` | Text (1000) | Optional |  |

### Choice sets

- **ECA Role:** Student Marketeer, Manager, Administrator
- **Active / Inactive:** Active, Inactive
- **Location Status:** Active, Paused, Removed
- **Institution Kind:** University, TAFE
- **Visit Status:** Completed, Scheduled, Cancelled
- **Approval Status:** Pending, Approved, Rejected, Duplicate
- **Yes / No:** Yes, No
- **ECA POS Type:** Price tag, Wobbler, Poster, Shelf strip, Fridge decal, Counter unit, Menu board, Vending decal, Other
- **Competitor (reference list):** Monster, V, Solo Energy, Rockstar, Celsius
- **ECA Contact Role:** Owner, Manager, Assistant manager, Supervisor, Buyer / purchasing, Staff member, Other
- **Report Type:** State summary, National breakdown, Audit export
- **Bullring or Bull’s Eye:** EYE, RING
- **Channel:** OnP, OffP
- **Classification:** A, B, C, D
- **IND or NKA:** IND, NKA
- **Vending Company:** AltaVend, Coke Vending, M&M, Melbourne Vending Co., Provender, Snack Savy, Vendy, Other
- **ECA Removal Reason:** Closed permanently, No longer stocks Red Bull, Duplicate entry, Moved or renamed, Not accessible to staff, Other
- **Snapshot Status:** In review, Final
- **Normalisation:** Relative to leader, Against targets
- **Approval Mode:** Manager approval, Count on submit
- **Distribution Method:** Email and in-app, Email only, In-app only, Teams post and in-app
- **Log Category:** Login, Activity, Approval, Correction, Score, Leaderboard, Distribution, People, Locations, Settings
- **Sign-in Result:** Signed in, Not on list, Deactivated, Wrong admin PIN, Locked out
- **Removal Target Type:** Store, Vending machine, University, TAFE