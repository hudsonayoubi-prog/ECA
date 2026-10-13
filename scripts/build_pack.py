import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment

import os, sys
# Usage: python3 scripts/build_pack.py <state_dump.json> <output.xlsx>
D = ''
S = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'docs/power-platform/state_dump.json'))
OUT = sys.argv[2] if len(sys.argv) > 2 else 'docs/power-platform/ECA_Dataverse_Build_Pack.xlsx'

F = 'Arial'
NAVY = '0B2A5B'
hdr_font = Font(name=F, bold=True, color='FFFFFF', size=10)
hdr_fill = PatternFill('solid', start_color=NAVY)
body = Font(name=F, size=10)
bold = Font(name=F, size=10, bold=True)
title = Font(name=F, size=16, bold=True, color=NAVY)
h2 = Font(name=F, size=12, bold=True, color=NAVY)
fill_in = PatternFill('solid', start_color='FFF5D1')   # cells to fill in
note_font = Font(name=F, size=9, italic=True, color='4A5568')
wrap = Alignment(wrap_text=True, vertical='top')

wb = Workbook()
ROLE = {'admin': 'Administrator', 'manager': 'Manager', 'marketeer': 'Student Marketeer'}
yn = lambda v: 'Yes' if v in (1, '1', True) else ('No' if v in (0, '0', False) else None)

# ---------------------------------------------------------------- schema
P = 'eca_'
schema = []  # (table display, table logical, col display, logical, type, required, detail, notes)
def T(tdisp, tlog, cols, desc):
    schema.append((tdisp, P + tlog, None, None, None, None, None, desc))
    for c in cols:
        d, lg, ty, req, det, nt = (list(c) + [None] * 6)[:6]
        schema.append((tdisp, P + tlog, d, P + lg, ty, req or 'Optional', det, nt))

T('State', 'state', [
    ('State Code', 'name', 'Text (10) · Primary name', 'Required', None, 'VIC, NSW, QLD, SA, WA'),
    ('State Name', 'statename', 'Text (100)', 'Required'),
], 'One row per state. Business Unit of the same name owns the state’s records.')
T('Store Location Type', 'storelocationtype', [
    ('Name', 'name', 'Text (100) · Primary name', 'Required', None, 'QSR, Vending, Student Bar, Convenience, NKA'),
    ('Active', 'active', 'Yes/No', 'Required', 'Default Yes', 'No = hidden from new records, kept on history'),
    ('Uses Vending Fields', 'usesvendingfields', 'Yes/No', 'Required', 'Default No', 'Yes for Vending: form shows machine fields'),
    ('Sort Order', 'sortorder', 'Whole number', 'Optional'),
], 'Admin-managed dropdown for every audit location.')
T('ECA User', 'ecauser', [
    ('Full Name', 'name', 'Text (200) · Primary name', 'Required', None, 'Display name, e.g. Charlotte Terrell'),
    ('First Name', 'firstname', 'Text (100)', 'Required'),
    ('Last Name', 'lastname', 'Text (100)', 'Required'),
    ('Normalised Name', 'normalisedname', 'Text (200)', 'Optional', 'Set by flow / Power Fx on save', 'lower case, no accents, hyphens and apostrophes as spaces; used for name sign-in'),
    ('Aliases', 'aliases', 'Text (400)', 'Optional', None, 'Comma separated other names, e.g. preferred first name'),
    ('Disambiguation Label', 'disambiguation', 'Text (100)', 'Optional', None, 'Required when two users share a name'),
    ('Role', 'role', 'Choice: ECA Role', 'Required'),
    ('State', 'state', 'Lookup → State', 'Optional', None, 'Blank for national Administrators'),
    ('Reports To', 'reportsto', 'Lookup → ECA User', 'Optional', None, 'Student Marketeers → their Manager'),
    ('Status', 'status', 'Choice: Active / Inactive', 'Required', 'Default Active'),
    ('Email', 'email', 'Email (200)', 'Optional', None, 'Red Bull email. Needed for Microsoft sign-in and for results emails'),
    ('Entra User', 'systemuser', 'Lookup → User (systemuser)', 'Optional', None, 'Links the record to the person’s Microsoft account'),
    ('Last Sign-in', 'lastsignin', 'Date and time', 'Optional'),
], 'The approved user list. Every audit, approval and score points at this table by ID, never by name.')
T('Channel Lead', 'channellead', [
    ('Name', 'name', 'Text (200) · Primary name', 'Required', None, 'e.g. VIC – Keane Vivas'),
    ('Lead', 'lead', 'Lookup → ECA User', 'Required'),
    ('State', 'state', 'Lookup → State', 'Required'),
], 'Education Channel Leads per state: approve removals, finalise and send results.')
T('Institution', 'institution', [
    ('Code', 'name', 'Text (10) · Primary name', 'Required', None, 'MON, RMIT … also the Location ID prefix'),
    ('Institution Name', 'institutionname', 'Text (200)', 'Required'),
    ('Short Name', 'shortname', 'Text (60)', 'Optional'),
    ('Kind', 'kind', 'Choice: University / TAFE', 'Required'),
    ('State', 'state', 'Lookup → State', 'Required'),
    ('Status', 'status', 'Choice: Active / Removed', 'Required', 'Default Active'),
    ('Note', 'note', 'Text (400)', 'Optional'),
    ('Logo', 'logo', 'Image', 'Optional', None, 'Official logo file uploaded by an Admin or Manager; tiles show the code when blank'),
], 'Universities and TAFEs.')
T('Campus', 'campus', [
    ('Campus Key', 'name', 'Text (120) · Primary name', 'Required', None, 'Institution code + campus, e.g. MON – Clayton (unique, used by imports)'),
    ('Campus Name', 'campusname', 'Text (100)', 'Required'),
    ('Institution', 'institution', 'Lookup → Institution', 'Required'),
], None)
ranging = [p for p in S['ref']['products']]
T('Location', 'location', [
    ('Location ID', 'name', 'Text (20) · Primary name', 'Required', 'Alternate key', 'MON-012 (store) or MON-VM-012 (vending). Never reused'),
    ('Location Name', 'locationname', 'Text (200)', 'Required'),
    ('Institution', 'institution', 'Lookup → Institution', 'Required'),
    ('Campus', 'campus', 'Lookup → Campus', 'Required'),
    ('Store Location Type', 'storelocationtype', 'Lookup → Store Location Type', 'Required'),
    ('Type Confirmed', 'typeconfirmed', 'Yes/No', 'Required', 'Default No', 'No = classified automatically from the workbook'),
    ('Status', 'status', 'Choice: Active / Paused / Removed', 'Required', 'Default Active'),
    ('Date Added', 'dateadded', 'Date only', 'Required'),
    ('Visit Cycle (days)', 'visitcycledays', 'Whole number 1–365', 'Required', 'Default 14'),
    ('Address', 'address', 'Text (300)'), ('Postcode', 'postcode', 'Text (10)'), ('Landmark', 'landmark', 'Text (200)'),
    ('Building', 'building', 'Text (100)'), ('Level', 'level', 'Text (50)'),
    *[(f'Ranged: {p["label"]}', 'rg_' + p['key'].lower(), 'Choice: Yes / No (blank = not checked)', 'Optional', None, 'Competitor' if p.get('competitor') else 'Red Bull SKU, scores ranging %') for p in ranging],
    ('POS Present', 'pospresent', 'Choice: Yes / No'), ('Cooler Present', 'coolerpresent', 'Choice: Yes / No'),
    ('Red Bull Price', 'redbullprice', 'Currency'), ('Top Competitor', 'topcompetitor', 'Text (100)'), ('Competitor Price', 'competitorprice', 'Currency'),
    ('Bullring or Bull’s Eye', 'bull', 'Choice: EYE / RING'), ('Channel', 'channel', 'Choice: OnP / OffP'), ('Classification', 'classification', 'Choice: A / B / C / D'),
    ('IND or NKA', 'indnka', 'Choice: IND / NKA'), ('Red Bull Owner', 'redbullowner', 'Text (100)'),
    ('Store Contact (legacy)', 'storecontact', 'Text (200)', 'Optional', 'Column security: Managers and Admins only', 'Masked value from the workbook; superseded by the four contact columns'),
    ('Contact Name', 'contactname', 'Text (200)', 'Optional', 'Set from the latest audit', 'Person spoken to; visible to everyone in the state'),
    ('Contact Role', 'contactrole', 'Choice: ECA Contact Role', 'Optional', 'Set from the latest audit'),
    ('Contact Phone', 'contactphone', 'Phone (30)', 'Optional', 'Column security: Managers and Admins read; Student Marketeers write only', 'Kept if an audit leaves it blank'),
    ('Contact Email', 'contactemail', 'Email (200)', 'Optional', 'Column security: Managers and Admins read; Student Marketeers write only', 'Kept if an audit leaves it blank'),
    ('Contact Recorded On', 'contactrecordedon', 'Date only', 'Optional'), ('Contact Recorded By', 'contactrecordedby', 'Lookup → ECA User', 'Optional'),
    ('Red Bull Front Facings', 'rbfacings', 'Whole number ≥ 0', 'Optional', 'Set from the latest completed audit'),
    ('Facings Recorded On', 'facingsrecordedon', 'Date only', 'Optional'),
    ('Vending Company', 'vendingcompany', 'Text (100)'), ('Machine ID', 'machineid', 'Text (50)'),
    ('V SKU Count', 'vskucount', 'Whole number'), ('V Price', 'vprice', 'Currency'), ('Monster SKU Count', 'monsterskucount', 'Whole number'), ('Monster Price', 'monsterprice', 'Currency'),
    ('Latest Note', 'latestnote', 'Multiline text (2000)'),
    ('Last Completed Visit', 'lastcompletedvisit', 'Date only', 'Optional', 'Set by flow on approved/complete visit'),
    ('Next Due', 'nextdue', 'Date only', 'Optional', 'Formula column: Last Completed Visit (or Date Added) + Visit Cycle'),
], 'Every QSR store and vending machine.')
T('Allocation', 'allocation', [
    ('Name', 'name', 'Text (200) · Primary name', 'Required', None, 'Person – Institution – Campus'),
    ('Staff Member', 'staffmember', 'Lookup → ECA User', 'Required'),
    ('Institution', 'institution', 'Lookup → Institution', 'Required'),
    ('Campus', 'campustext', 'Text (100)', 'Optional', None, '“All” or a campus name'),
    ('Status', 'status', 'Choice: Active / Inactive', 'Required'),
], 'Who usually covers which campus (guidance, not a lock).')
T('Competitor', 'competitor', [
    ('Name', 'name', 'Text (100) · Primary name', 'Required', None, 'Monster, V, Solo Energy, Rockstar, Celsius, plus any added in the field'),
    ('Active', 'active', 'Yes/No', 'Required', 'Default Yes', 'Active ones show as tick chips in audit step 3'),
    ('Added From Field', 'addedfromfield', 'Yes/No', 'Optional', 'Default No', 'Yes = typed in by a Student Marketeer via Add competitor; Admin to review'),
], 'Competitor brands for front facings and competitor execution.')
T('Location Competitor', 'locationcompetitor', [
    ('Name', 'name', 'Text (200) · Primary name', 'Required', None, 'Location ID – competitor'),
    ('Location', 'location', 'Lookup → Location', 'Required'), ('Competitor', 'competitor', 'Lookup → Competitor', 'Required'),
    ('Front Facings', 'facings', 'Whole number ≥ 0', 'Required'), ('Price', 'price', 'Currency', 'Optional'),
    ('POS Pieces', 'pospieces', 'Whole number ≥ 0', 'Optional', None, 'Stores only, not vending'), ('Coolers', 'coolers', 'Whole number ≥ 0', 'Optional', None, 'Stores only, not vending'),
], 'Latest competitor picture per location (replaced on every completed audit). Pre-ticks competitors at the next audit.')
T('Audit Visit', 'auditvisit', [
    ('Visit ID', 'name', 'Autonumber or text · Primary name', 'Required', None, 'e.g. MON-V0001'),
    ('Location', 'location', 'Lookup → Location', 'Required'),
    ('Institution', 'institution', 'Lookup → Institution', 'Required'),
    ('Visit Date', 'visitdate', 'Date only', 'Required'), ('Visit Time', 'visittime', 'Text (5)', 'Optional', None, 'HH:MM local'),
    ('Staff Member', 'staffmember', 'Lookup → ECA User', 'Optional', None, 'Blank only on imported history'),
    ('Visit Status', 'visitstatus', 'Choice: Completed / Scheduled / Cancelled', 'Required'),
    ('Approval Status', 'approvalstatus', 'Choice: Pending / Approved / Rejected / Duplicate', 'Optional', None, 'Completed visits only'),
    ('Approved By', 'approvedby', 'Lookup → ECA User'), ('Approved On', 'approvedon', 'Date and time'), ('Reject Reason', 'rejectreason', 'Text (400)'),
    ('Duplicate Of', 'duplicateof', 'Lookup → Audit Visit'),
    ('Reporting Month', 'reportingmonth', 'Text (7)', 'Optional', 'Formula column', 'YYYY-MM from Visit Date'),
    ('DPs Added', 'dpsadded', 'Whole number ≥ 0', 'Required', 'Default 0'), ('DPs Lost', 'dpslost', 'Whole number ≥ 0', 'Required', 'Default 0'),
    ('Editions Sold In', 'editionssold', 'Whole number ≥ 0', 'Required', 'Default 0'), ('Edition Flavours', 'editionflavours', 'Text (200)'),
    ('POS Placed', 'posplaced', 'Whole number ≥ 0', 'Required', 'Default 0'), ('POS Type', 'postype', 'Choice: ECA POS Type'),
    ('Coolers Installed', 'coolersin', 'Whole number ≥ 0', 'Required', 'Default 0'), ('Coolers Removed', 'coolersout', 'Whole number ≥ 0', 'Required', 'Default 0'),
    ('Ranging Answers', 'rangingjson', 'Multiline text', 'Optional', None, 'JSON of Yes/No per SKU on this visit (used for ranging %)'),
    ('Ranging %', 'rangingpct', 'Decimal 0–100', 'Optional', 'Set by app on submit', 'Red Bull SKUs ranged ÷ applicable'),
    ('Notes', 'notes', 'Multiline text (4000)'), ('Next Step', 'nextstep', 'Text (400)'), ('Follow-up Date', 'followup', 'Date only'),
    ('Issue', 'issue', 'Text (400)'), ('Photo Count', 'photocount', 'Whole number', 'Optional', None, 'Photos stored as Notes/attachments or a File column'),
    ('Imported', 'imported', 'Yes/No', 'Required', 'Default No', 'Yes = history from the workbook, never scores'),
    ('Correction Reason', 'correctionreason', 'Text (400)', 'Optional', None, 'Required when edited after the month is final'),
    ('Contact Name', 'contactname', 'Text (200)', 'Optional', 'Required for Completed visits', 'Who the Student Marketeer spoke to (step 1)'),
    ('Contact Role', 'contactrole', 'Choice: ECA Contact Role', 'Optional'),
    ('Red Bull Price', 'redbullprice', 'Currency'), ('Top Competitor', 'topcompetitor', 'Text (100)', 'Optional', 'Set by app', 'Competitor with most facings; kept for older reports'),
    ('Competitor Price', 'competitorprice', 'Currency', 'Optional', 'Set by app', 'Price of the top competitor'),
    ('Red Bull POS Present', 'rbpospresent', 'Choice: Yes / No'), ('Red Bull Cooler Present', 'rbcoolerpresent', 'Choice: Yes / No'),
    ('Red Bull Front Facings', 'rbfacings', 'Whole number ≥ 0', 'Optional', 'Completed visits only'),
    ('Competitor Front Facings', 'compfacings', 'Whole number ≥ 0', 'Optional', 'Rollup: sum of Visit Competitor facings'),
    ('Share of Shelf %', 'shareofshelf', 'Decimal 0–100', 'Optional', 'Formula: Red Bull ÷ (Red Bull + competitor) facings'),
    ('Competitor POS Seen', 'comppos', 'Whole number', 'Optional', 'Rollup: sum of Visit Competitor POS'), ('Competitor Coolers Seen', 'compcoolers', 'Whole number', 'Optional', 'Rollup: sum of Visit Competitor coolers'),
], 'Every visit. Only Completed + Approved + named Student Marketeer + not imported counts on the leaderboard.')
T('Visit Competitor', 'visitcompetitor', [
    ('Name', 'name', 'Text (200) · Primary name', 'Required', None, 'Visit ID – competitor'),
    ('Audit Visit', 'auditvisit', 'Lookup → Audit Visit', 'Required', 'Parental (cascade delete)'), ('Competitor', 'competitor', 'Lookup → Competitor', 'Required'),
    ('Front Facings', 'facings', 'Whole number ≥ 0', 'Required', 'Default 0'), ('Price', 'price', 'Currency', 'Optional'),
    ('POS Pieces', 'pospieces', 'Whole number ≥ 0', 'Optional', 'Default 0', 'Stores only'), ('Coolers', 'coolers', 'Whole number ≥ 0', 'Optional', 'Default 0', 'Stores only'),
], 'One row per competitor recorded on an audit (step 3). Any number per visit.')
T('Monthly Report', 'monthlyreport', [
    ('Name', 'name', 'Text (100) · Primary name', 'Required', None, 'e.g. 2026-09 · VIC · State summary'),
    ('Month', 'month', 'Text (7)', 'Required', None, 'YYYY-MM'),
    ('Report Type', 'reporttype', 'Choice: State summary / National breakdown / Audit export', 'Required'),
    ('State', 'state', 'Lookup → State', 'Optional', None, 'Blank = all states'),
    ('Generated On', 'generatedon', 'Date and time', 'Required', None, 'Summaries: 1st of next month 08:00. Audit export: last calendar day 18:00'),
    ('File', 'file', 'File (Excel)', 'Optional', None, 'The generated .xlsx (audit export includes the Dashboard sheet with charts)'),
    ('Recipients', 'recipients', 'Text (2000)', 'Optional', None, 'Managers + Channel Leads for state reports; Administrators for national'),
], 'Optional in production: Power Automate writes one row per generated report so the Notifications screen can list and download them.')
T('Scoring Rule Set', 'scoringruleset', [
    ('Name', 'name', 'Text (100) · Primary name', 'Required'),
    ('Effective From', 'effectivefrom', 'Date only', 'Required'),
    ('Weight Ranging', 'wranging', 'Whole number 0–100', 'Required'), ('Weight TDP', 'wtdp', 'Whole number 0–100', 'Required'),
    ('Weight Editions', 'weditions', 'Whole number 0–100', 'Required'), ('Weight POS', 'wpos', 'Whole number 0–100', 'Required'), ('Weight Coolers', 'wcoolers', 'Whole number 0–100', 'Required'),
    ('Normalisation', 'normalisation', 'Choice: Relative to leader / Against targets', 'Required'),
    ('Target TDP', 'ttdp', 'Whole number'), ('Target Editions', 'teditions', 'Whole number'), ('Target POS', 'tpos', 'Whole number'), ('Target Coolers', 'tcoolers', 'Whole number'),
    ('Minimum Approved Audits', 'minaudits', 'Whole number ≥ 1', 'Required'),
    ('Approval Mode', 'approvalmode', 'Choice: Manager approval / Count on submit', 'Required'),
    ('Is Current', 'iscurrent', 'Yes/No', 'Required'),
], 'Weights must total 100. A new row per change; snapshots point at the row they used.')
T('Leaderboard Snapshot', 'leaderboardsnapshot', [
    ('Month', 'name', 'Text (7) · Primary name', 'Required', 'Alternate key', 'YYYY-MM'),
    ('Status', 'status', 'Choice: In review / Final', 'Required'),
    ('Created On', 'snapshotcreated', 'Date and time', 'Required'),
    ('Finalised By', 'finalisedby', 'Lookup → ECA User'), ('Finalised On', 'finalisedon', 'Date and time'),
    ('Rule Set', 'ruleset', 'Lookup → Scoring Rule Set', 'Required'),
    ('Unapproved Audits Excluded', 'excludedpending', 'Whole number'),
], 'Created at month end by flow; locked when Final.')
T('Snapshot Row', 'snapshotrow', [
    ('Name', 'name', 'Text (200) · Primary name', 'Required', None, 'Month – person'),
    ('Snapshot', 'snapshot', 'Lookup → Leaderboard Snapshot', 'Required'), ('Student Marketeer', 'user', 'Lookup → ECA User', 'Required'),
    ('Rank', 'rank', 'Whole number', 'Optional', None, 'Blank = not ranked'), ('Total Score', 'totalscore', 'Decimal (1 dp)'), ('Qualified', 'qualified', 'Yes/No'),
    ('Approved Audits', 'audits', 'Whole number'), ('Ranging %', 'rangingpct', 'Decimal'), ('TDP Added', 'tdp', 'Whole number'), ('Editions Sold', 'editions', 'Whole number'),
    ('POS Placed', 'pos', 'Whole number'), ('Coolers Added', 'coolers', 'Whole number'),
    ('Score Ranging', 'sranging', 'Decimal'), ('Score TDP', 'stdp', 'Decimal'), ('Score Editions', 'seditions', 'Decimal'), ('Score POS', 'spos', 'Decimal'), ('Score Coolers', 'scoolers', 'Decimal'),
], None)
T('Results Distribution', 'resultsdistribution', [
    ('Name', 'name', 'Text (100) · Primary name', 'Required'), ('Snapshot', 'snapshot', 'Lookup → Leaderboard Snapshot', 'Required'),
    ('Generated On', 'generatedon', 'Date and time'), ('Distributed On', 'distributedon', 'Date and time'), ('Distributed By', 'distributedby', 'Lookup → ECA User'),
    ('Groups', 'groups', 'Text (300)'), ('Method', 'method', 'Choice: Email and in-app / Email only / In-app only / Teams post and in-app'),
    ('Message', 'message', 'Multiline text (4000)'), ('Recipient Count', 'recipientcount', 'Whole number'),
], None)
T('Distribution Settings', 'distributionsettings', [
    ('Name', 'name', 'Text (100) · Primary name', 'Required', None, 'Single row: “Default”'),
    ('Send to Channel Leads', 'toleads', 'Yes/No'), ('Send to Administrators', 'toadmins', 'Yes/No'), ('Send to Student Marketeers', 'tosms', 'Yes/No'),
    ('Additional Recipients', 'extra', 'Text (1000)', 'Optional', None, 'Emails, semicolon separated'),
    ('Method', 'method', 'Choice (as Results Distribution)'), ('Send By Business Day', 'businessday', 'Whole number 1–10'), ('Message Template', 'template', 'Multiline text (2000)'),
], None)
T('Removal Request', 'removalrequest', [
    ('Request ID', 'name', 'Autonumber RR-{SEQNUM:4} · Primary name', 'Required'),
    ('Target Type', 'targettype', 'Choice: Store / Vending machine / University / TAFE'), ('Location', 'location', 'Lookup → Location'), ('Institution', 'institution', 'Lookup → Institution'),
    ('State', 'state', 'Lookup → State'), ('Requested By', 'requestedby', 'Lookup → ECA User'), ('Reason', 'reason', 'Choice: ECA Removal Reason'), ('Comments', 'comments', 'Text (1000)'),
    ('Status', 'status', 'Choice: Pending / Approved / Rejected'), ('Decided By', 'decidedby', 'Lookup → ECA User'), ('Decided On', 'decidedon', 'Date and time'), ('Decision Note', 'decisionnote', 'Text (400)'),
], None)
T('Sign-in Event', 'signinevent', [
    ('Name', 'name', 'Text (200) · Primary name', 'Required', None, 'Name entered'), ('Matched User', 'user', 'Lookup → ECA User'),
    ('Result', 'result', 'Choice: Signed in / Not on list / Deactivated / Wrong admin PIN / Locked out'), ('Signed In On', 'signedinon', 'Date and time'), ('Device', 'device', 'Text (200)'),
], 'Only needed if the name sign-in fallback is used; Microsoft sign-in is logged by Entra ID.')
T('ECA Audit Log', 'auditlog', [
    ('Action', 'name', 'Text (200) · Primary name', 'Required'), ('Category', 'category', 'Choice: Log Category'),
    ('User', 'user', 'Lookup → ECA User'), ('Logged On', 'loggedon', 'Date and time'), ('Table', 'tablename', 'Text (100)'), ('Record', 'recordid', 'Text (100)'),
    ('Previous Value', 'previousvalue', 'Multiline text (2000)'), ('New Value', 'newvalue', 'Multiline text (2000)'), ('Detail', 'detail', 'Text (1000)'),
], 'Append-only: every security role gets Create + Read only. Turn on Dataverse auditing as well.')

# ---------------------------------------------------------------- helpers
NOTES = []
def sheet(name, headers, rows, widths=None, note=None, fill_cols=(), table=True, tname=None):
    ws = wb.create_sheet(name)
    r0 = 1  # headers must be on row 1 for Dataverse 'Import from Excel'
    for j, h in enumerate(headers, 1):
        c = ws.cell(r0, j, h); c.font = hdr_font; c.fill = hdr_fill; c.alignment = Alignment(wrap_text=True, vertical='center')
    for i, row in enumerate(rows, r0 + 1):
        for j, v in enumerate(row, 1):
            c = ws.cell(i, j, v); c.font = body; c.alignment = Alignment(vertical='top', wrap_text=isinstance(v, str) and len(v) > 40)
            if headers[j - 1] in fill_cols and (v is None or v == ''):
                c.fill = fill_in
    for j, h in enumerate(headers, 1):
        w = (widths or {}).get(h) or min(45, max(10, len(h) + 2, *[len(str(r[j - 1])) + 2 for r in rows[:200] if r[j - 1] is not None] or [10]))
        ws.column_dimensions[get_column_letter(j)].width = w
    ws.freeze_panes = ws.cell(r0 + 1, 1)
    if note:
        ws.cell(1, 1).comment = Comment(note, 'ECA build pack'); ws.cell(1, 1).comment.width = 400; ws.cell(1, 1).comment.height = 120
        NOTES.append((name, note))
    if table and rows:
        ref = f'A{r0}:{get_column_letter(len(headers))}{r0 + len(rows)}'
        t = Table(displayName=tname or ''.join(ch for ch in name if ch.isalnum()), ref=ref)
        t.tableStyleInfo = TableStyleInfo(name='TableStyleLight9', showRowStripes=True)
        ws.add_table(t)
    return ws, r0

# ---------------------------------------------------------------- Read me
ws = wb.active; ws.title = 'Read me'
lines = [
    ('Education Channel Audit Tool (ECA)', title),
    ('Dataverse build pack · updated 13 Oct 2026 from the ECA prototype (v29) and Education_Channel_Execution_Tracker_v3', note_font),
    ('', None),
    ('What this workbook is', h2),
    ('1. “Tables & columns” is the Dataverse schema to create (publisher prefix eca_). “Choices” lists every choice set.', body),
    ('2. The data sheets are ready to import into those tables, in the order below. Column headers match the column display names, so Dataverse import maps them automatically.', body),
    ('3. “Checks” counts rows and flags gaps with live formulas. Get every check to OK before go-live.', body),
    ('', None),
    ('Import order (lookups must exist first)', h2),
    ('1 States → 2 Store Location Types → 3 ECA Users (without Reports To) → 4 ECA Users again (Reports To only) → 5 Channel Leads → 6 Institutions → 7 Campuses → 8 Locations → 9 Allocations → 10 Audit Visits (history) → 11 Scoring Rule Set → 12 Distribution Settings → 13 Competitors', body),
    ('How: make.powerapps.com → Tables → open the table → Import → Import data from Excel, pick the sheet, check the mapping, Import. Lookups match on the related table’s primary name column (State Code, Full Name, Code, Campus Key, Location ID).', body),
    ('', None),
    ('Legend', h2),
    ('Pale yellow cells = to fill in before import (for example Red Bull emails). Everything else comes from the prototype and workbook.', body),
    ('', None),
    ('Things to know', h2),
    ('• Store contacts are blank: the prototype masked them. Copy them from the v3 workbook’s audit tabs, or leave blank. Only Managers and Admins can see that column.', body),
    ('• Store Location Type was set automatically from the workbook (Vending; NKA flag; bar names → Student Bar; everything else QSR). Type Confirmed = No on all of them. Nothing is Convenience yet.', body),
    ('• The 103 visit rows are the workbook’s last-visit dates. They have no staff member and are marked Imported, so they set visit due dates but never score.', body),
    ('• SA Student Marketeers report to Teneisha Clarisse. The 8 VIC workbook staff have no Reports To yet. Bronte Stock is a QLD Manager with nobody reporting to her. Renee Christison is listed as a Student Marketeer (title Senior Field Marketing Specialist).', body),
    ('• The leaderboard demo activity in the prototype is NOT included. Production starts from real audits.', body),
    ('• Scoring weights are recommendations to confirm with Sales.', body),
    ('• New since 9 Oct: universities and TAFEs for every state (Adelaide University reflects the 2026 merger), store contact columns, Red Bull and competitor front facings, the Competitor / Location Competitor / Visit Competitor tables, institution logos and the Monthly Report table.', body),
    ('• NSW, QLD, SA and WA institutions have no audit locations yet; they are added in the app (or imported here later).', body),
]
for i, (t, f) in enumerate(lines, 1):
    c = ws.cell(i, 1, t)
    if f: c.font = f
    c.alignment = Alignment(wrap_text=True, vertical='top')
ws.column_dimensions['A'].width = 130

# ---------------------------------------------------------------- schema sheet
ws = wb.create_sheet('Tables & columns')
heads = ['Table', 'Table logical name', 'Column', 'Column logical name', 'Data type', 'Required', 'Default / behaviour', 'Notes']
for j, h in enumerate(heads, 1):
    c = ws.cell(1, j, h); c.font = hdr_font; c.fill = hdr_fill
r = 2
for row in schema:
    is_t = row[2] is None
    vals = [row[0], row[1], row[2] or '(table)', row[3] or '', row[4] or '', row[5] or '', row[6] or '', row[7] or '']
    for j, v in enumerate(vals, 1):
        c = ws.cell(r, j, v); c.font = bold if is_t else body; c.alignment = Alignment(wrap_text=True, vertical='top')
        if is_t: c.fill = PatternFill('solid', start_color='E8EEF8')
    r += 1
for j, w in enumerate([20, 26, 26, 26, 30, 10, 28, 55], 1):
    ws.column_dimensions[get_column_letter(j)].width = w
ws.freeze_panes = 'A2'; ws.auto_filter.ref = f'A1:H{r - 1}'

# ---------------------------------------------------------------- choices
choices = [
    ('ECA Role', ['Student Marketeer', 'Manager', 'Administrator']),
    ('Active / Inactive', ['Active', 'Inactive']),
    ('Location Status', ['Active', 'Paused', 'Removed']),
    ('Institution Kind', ['University', 'TAFE']),
    ('Visit Status', S['ref']['visitStatuses']),
    ('Approval Status', ['Pending', 'Approved', 'Rejected', 'Duplicate']),
    ('Yes / No', ['Yes', 'No']),
    ('ECA POS Type', S['ref']['posTypes']),
    ('Competitor (reference list)', [c for c in S['ref']['competitors'] if c != 'None']),
    ('ECA Contact Role', S['ref'].get('contactRoles', [])),
    ('Report Type', ['State summary', 'National breakdown', 'Audit export']),
    ('Bullring or Bull’s Eye', S['ref']['bull']),
    ('Channel', S['ref']['channels']),
    ('Classification', S['ref']['classifications']),
    ('IND or NKA', ['IND', 'NKA']),
    ('Vending Company', S['ref']['vendingCompanies']),
    ('ECA Removal Reason', S['ref']['removalReasons']),
    ('Snapshot Status', ['In review', 'Final']),
    ('Normalisation', ['Relative to leader', 'Against targets']),
    ('Approval Mode', ['Manager approval', 'Count on submit']),
    ('Distribution Method', ['Email and in-app', 'Email only', 'In-app only', 'Teams post and in-app']),
    ('Log Category', ['Login', 'Activity', 'Approval', 'Correction', 'Score', 'Leaderboard', 'Distribution', 'People', 'Locations', 'Settings']),
    ('Sign-in Result', ['Signed in', 'Not on list', 'Deactivated', 'Wrong admin PIN', 'Locked out']),
    ('Removal Target Type', ['Store', 'Vending machine', 'University', 'TAFE']),
]
rows = [(n, v, (i + 1)) for n, vs in choices for i, v in enumerate(vs)]
sheet('Choices', ['Choice set', 'Label', 'Order'], rows, widths={'Choice set': 24, 'Label': 30, 'Order': 8}, tname='Choices')

# ---------------------------------------------------------------- data sheets
sheet('1 States', ['State Code', 'State Name'], [(x['code'], x['name']) for x in S['states']], tname='States')
STD = ['QSR', 'Vending', 'Student Bar', 'Convenience', 'NKA']
sheet('2 Store Location Types', ['Name', 'Active', 'Uses Vending Fields', 'Sort Order'], [(n, 'Yes', 'Yes' if n == 'Vending' else 'No', i + 1) for i, n in enumerate(STD)], tname='StoreTypes')

people = S['people']
def split(n):
    parts = n.split(' ')
    return parts[0], ' '.join(parts[1:])
urows = []
for p in sorted(people, key=lambda p: (['admin', 'manager', 'marketeer'].index(p['role']), p['state'] or '', p['name'])):
    fn, ln = split(p['name'])
    urows.append((p['name'], fn, ln, ROLE[p['role']], p['state'], p['status'], None, p.get('disambig'), ', '.join(p.get('aliases') or []) or None))
sheet('3 ECA Users', ['Full Name', 'First Name', 'Last Name', 'Role', 'State', 'Status', 'Email', 'Disambiguation Label', 'Aliases'], urows,
      note='Import first WITHOUT Reports To. Fill the Email column (pale yellow) with each person’s Red Bull address before import if you use Microsoft sign-in.', fill_cols=('Email',), tname='Users')
sheet('4 Reports To', ['Full Name', 'Reports To'], [(p['name'], p['reportsTo']) for p in sorted(people, key=lambda p: p['name']) if p['role'] == 'marketeer'],
      note='Second pass on ECA User: update Reports To. Blank = no manager set yet (the 8 VIC workbook staff).', fill_cols=('Reports To',), tname='ReportsTo')
sheet('5 Channel Leads', ['Name', 'Lead', 'State'], [(f'{st} – {n}', n, st) for st, ns in S['leads'].items() for n in ns], tname='Leads')
sheet('6 Institutions', ['Code', 'Institution Name', 'Short Name', 'Kind', 'State', 'Status', 'Note'], [(u['code'], u['name'], u.get('short'), u['kind'], u['state'], u['status'], u.get('note')) for u in S['unis']], tname='Institutions')
camp = []
for u in S['unis']:
    for c in u['campuses']:
        camp.append((f"{u['code']} – {c}", c, u['code']))
sheet('7 Campuses', ['Campus Key', 'Campus Name', 'Institution'], camp, tname='Campuses')

lheads = ['Location ID', 'Location Name', 'Institution', 'Campus', 'Store Location Type', 'Type Confirmed', 'Status', 'Date Added', 'Visit Cycle (days)', 'Address', 'Postcode', 'Landmark', 'Building', 'Level'] \
    + [f'Ranged: {p["label"]}' for p in ranging] + ['POS Present', 'Cooler Present', 'Red Bull Price', 'Top Competitor', 'Competitor Price', 'Bullring or Bull’s Eye', 'Channel', 'Classification', 'IND or NKA', 'Red Bull Owner', 'Store Contact', 'Vending Company', 'Machine ID', 'V SKU Count', 'V Price', 'Monster SKU Count', 'Monster Price', 'Latest Note']
lrows = []
for l in sorted(S['locations'], key=lambda l: l['id']):
    rg = l.get('ranging') or {}
    lrows.append([l['id'], l['name'], l['uni'], f"{l['uni']} – {l['campus']}", S['stGuess'][l['id']], 'No', l['status'], l.get('added'), l.get('cycle') or 14,
                  l.get('address'), l.get('postcode'), l.get('landmark'), l.get('building'), l.get('level')]
                 + [yn(rg.get(p['key'])) for p in ranging]
                 + [yn(l.get('pos')), yn(l.get('cooler')), l.get('price'), l.get('topComp'), l.get('compPrice'), l.get('bull'), l.get('channel'), l.get('classification'), l.get('indNka'), l.get('pic'), None,
                    l.get('vendCo'), l.get('machineId'), l.get('vSku'), l.get('vPrice'), l.get('mSku'), l.get('mPrice'), l.get('notes')])
ws, r0 = sheet('8 Locations', lheads, lrows, note='Store Contact is blank (masked in the prototype): copy from the v3 workbook if you want it. Type Confirmed = No: check Store Location Type, especially which stores are Convenience.',
               widths={'Location Name': 34, 'Latest Note': 45, 'Address': 30}, tname='Locations')
for i in range(r0 + 1, r0 + 1 + len(lrows)):
    for col in ('Red Bull Price', 'Competitor Price', 'V Price', 'Monster Price'):
        ws.cell(i, lheads.index(col) + 1).number_format = '$#,##0.00'
dv = DataValidation(type='list', formula1='"' + ','.join(STD) + '"', allow_blank=False)
ws.add_data_validation(dv); dv.add(f'E{r0 + 1}:E{r0 + len(lrows)}')

alloc = [(f"{a['staff']} – {a['uni']} – {a['campus']}", a['staff'], a['uni'], a['campus'], a['status']) for a in S['seedAlloc'] if any(p['name'] == a['staff'] for p in people)]
sheet('9 Allocations', ['Name', 'Staff Member', 'Institution', 'Campus', 'Status'], alloc, tname='Allocations')
vheads = ['Visit ID', 'Location', 'Institution', 'Visit Date', 'Visit Time', 'Staff Member', 'Visit Status', 'Approval Status', 'DPs Added', 'DPs Lost', 'Editions Sold In', 'POS Placed', 'Coolers Installed', 'Coolers Removed', 'Notes', 'Next Step', 'Imported']
vrows = [(v['id'], v['loc'], v['uni'], v['date'], v.get('time'), v.get('staff'), v['status'], None, v['dpAdded'], v['dpLost'], v['editions'], v['posPlaced'], v['coolersIn'], v['coolersOut'], v.get('notes'), v.get('nextStep'), 'Yes' if v.get('imported') else 'No') for v in sorted(S['visits'], key=lambda v: v['id'])]
sheet('10 Audit Visits', vheads, vrows, note='History from the workbook: last-visit dates only, no staff, Imported = Yes. Sets visit due dates; never scores.', widths={'Next Step': 45, 'Notes': 30}, tname='Visits')
sheet('13 Competitors', ['Name', 'Active', 'Added From Field'], [(c, 'Yes', 'No') for c in S['ref']['competitors'] if c != 'None'], tname='Competitors')
sc = S['ref']['scoring']
sheet('11 Scoring Rule Set', ['Name', 'Effective From', 'Weight Ranging', 'Weight TDP', 'Weight Editions', 'Weight POS', 'Weight Coolers', 'Normalisation', 'Target TDP', 'Target Editions', 'Target POS', 'Target Coolers', 'Minimum Approved Audits', 'Approval Mode', 'Is Current'],
      [('Launch (recommended)', '2026-11-01', sc['weights']['ranging'], sc['weights']['tdp'], sc['weights']['editions'], sc['weights']['pos'], sc['weights']['coolers'], 'Relative to leader',
        sc['targets']['tdp'], sc['targets']['editions'], sc['targets']['pos'], sc['targets']['coolers'], sc['minAudits'], 'Manager approval', 'Yes')],
      note='RECOMMENDED starting values, not agreed. Weights must total 100 (see Checks). Effective From assumes a 1 Nov 2026 launch: change to your go-live date.', tname='Scoring')
rs = S['ref']['results']
sheet('12 Distribution Settings', ['Name', 'Send to Channel Leads', 'Send to Administrators', 'Send to Student Marketeers', 'Additional Recipients', 'Method', 'Send By Business Day', 'Message Template'],
      [('Default', 'Yes', 'Yes', 'Yes', None, rs['method'], rs['businessDay'], rs['template'])], widths={'Message Template': 70}, tname='Distribution')

# ---------------------------------------------------------------- checks (formulas)
ws = wb.create_sheet('Checks')
ws['A1'] = 'Data checks'; ws['A1'].font = title
ws['A2'] = 'Live formulas over the data sheets. Fix anything not OK before import.'; ws['A2'].font = note_font
hd = ['Check', 'Value', 'Expected', 'Result']
for j, h in enumerate(hd, 1):
    c = ws.cell(4, j, h); c.font = hdr_font; c.fill = hdr_fill
NU = len(urows); NL = len(lrows); NV = len(vrows)
checks = [
    ('ECA Users loaded', '=COUNTA(Users[Full Name])', NU, 'eq'),
    ('…of which Student Marketeers', '=COUNTIF(Users[Role],"Student Marketeer")', None, 'info'),
    ('…of which Managers', '=COUNTIF(Users[Role],"Manager")', None, 'info'),
    ('…of which Administrators', '=COUNTIF(Users[Role],"Administrator")', None, 'info'),
    ('Users without an email (needed for Microsoft sign-in and results emails)', '=COUNTBLANK(Users[Email])', 0, 'eq'),
    ('Duplicate full names (need a Disambiguation Label)', '=SUMPRODUCT((COUNTIF(Users[Full Name],Users[Full Name])>1)*1)', 0, 'eq'),
    ('Student Marketeers with no Reports To', '=COUNTBLANK(ReportsTo[Reports To])', 0, 'eq'),
    ('Reports To names not found as a Manager', '=SUMPRODUCT((ReportsTo[Reports To]<>"")*(COUNTIFS(Users[Full Name],ReportsTo[Reports To],Users[Role],"Manager")=0))', 0, 'eq'),
    ('Non-admins with no State', '=COUNTIFS(Users[Role],"<>Administrator",Users[State],"")', 0, 'eq'),
    ('Channel Leads not on the user list', '=SUMPRODUCT((COUNTIF(Users[Full Name],Leads[Lead])=0)*1)', 0, 'eq'),
    ('Locations loaded', '=COUNTA(Locations[Location ID])', NL, 'eq'),
    ('Duplicate Location IDs', '=SUMPRODUCT((COUNTIF(Locations[Location ID],Locations[Location ID])>1)*1)', 0, 'eq'),
    ('Locations whose campus is not in Campuses', '=SUMPRODUCT((COUNTIF(Campuses[Campus Key],Locations[Campus])=0)*1)', 0, 'eq'),
    ('Locations with an invalid Store Location Type', '=SUMPRODUCT((COUNTIF(StoreTypes[Name],Locations[Store Location Type])=0)*1)', 0, 'eq'),
    ('Store location type: QSR', '=COUNTIF(Locations[Store Location Type],"QSR")', None, 'info'),
    ('Store location type: Vending', '=COUNTIF(Locations[Store Location Type],"Vending")', None, 'info'),
    ('Store location type: Student Bar', '=COUNTIF(Locations[Store Location Type],"Student Bar")', None, 'info'),
    ('Store location type: Convenience', '=COUNTIF(Locations[Store Location Type],"Convenience")', None, 'info'),
    ('Store location type: NKA', '=COUNTIF(Locations[Store Location Type],"NKA")', None, 'info'),
    ('Store types still to confirm', '=COUNTIF(Locations[Type Confirmed],"No")', 0, 'eq'),
    ('Visit history rows', '=COUNTA(Visits[Visit ID])', NV, 'eq'),
    ('Visits pointing at an unknown location', '=SUMPRODUCT((COUNTIF(Locations[Location ID],Visits[Location])=0)*1)', 0, 'eq'),
    ('Scoring weights total', '=SUM(Scoring[Weight Ranging],Scoring[Weight TDP],Scoring[Weight Editions],Scoring[Weight POS],Scoring[Weight Coolers])', 100, 'eq'),
]
for i, (lab, f, exp, kind) in enumerate(checks, 5):
    ws.cell(i, 1, lab).font = body
    ws.cell(i, 2, f).font = body
    ws.cell(i, 3, exp if exp is not None else 'info').font = body
    ws.cell(i, 4, f'=IF(C{i}="info","—",IF(B{i}=C{i},"OK","Check"))' if True else None).font = bold
    if exp is not None and kind == 'eq' and exp == NU and lab.startswith('ECA'):
        ws.cell(i, 3).comment = Comment('Number of users in the prototype on 9 Oct 2026', 'ECA')
ws.column_dimensions['A'].width = 70; ws.column_dimensions['B'].width = 10; ws.column_dimensions['C'].width = 10; ws.column_dimensions['D'].width = 10
from openpyxl.formatting.rule import CellIsRule
last = 4 + len(checks)
ws.conditional_formatting.add(f'D5:D{last}', CellIsRule(operator='equal', formula=['"OK"'], fill=PatternFill('solid', start_color='E3F4EA'), font=Font(name=F, bold=True, color='1E7B45')))
ws.conditional_formatting.add(f'D5:D{last}', CellIsRule(operator='equal', formula=['"Check"'], fill=PatternFill('solid', start_color='FDE8EB'), font=Font(name=F, bold=True, color='9B0B22')))
rm = wb['Read me']; rr = rm.max_row + 2
rm.cell(rr, 1, 'Sheet notes (also shown as a comment on each sheet’s first header)').font = h2
for k, (nm, nt) in enumerate(NOTES, rr + 1):
    c = rm.cell(k, 1, f'{nm}: {nt}'); c.font = body; c.alignment = Alignment(wrap_text=True, vertical='top')
rm.cell(rr + len(NOTES) + 1, 1, 'Header row is row 1 on every data sheet, as Dataverse import expects. Remove nothing above the headers.').font = note_font
wb.move_sheet('Checks', offset=-(len(wb.sheetnames) - 2))
wb.save(OUT)
print('saved', OUT, NU, NL, NV, len(schema))
