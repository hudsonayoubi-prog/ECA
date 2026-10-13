"""Stage 2: validate and load the build pack's data sheets into Dataverse.

  python3 scripts/pp_import.py                 # VALIDATE only (default, offline): checks every sheet, prints a report
  python3 scripts/pp_import.py --apply         # validate, then upsert into Dataverse (needs DATAVERSE_URL, DATAVERSE_TOKEN)
  python3 scripts/pp_import.py --apply --only 8   # just one sheet by its number

Reads docs/power-platform/ECA_Dataverse_Build_Pack.xlsx and schema/eca-schema.json. Rows are UPSERTED on the
primary-name alternate key, so re-running is safe. Lookups bind by the related row's name. Import order follows
the pack's "Read me". Prints counts only, never names, emails or contacts.
Run in Dev/Test first. Needs the Stage 1 schema applied (scripts/pp_deploy.py).
"""
import argparse, json, os, re, sys, urllib.parse
from datetime import date, datetime
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'docs/power-platform/ECA_Dataverse_Build_Pack.xlsx')
SCHEMA = os.path.join(ROOT, 'docs/power-platform/schema/eca-schema.json')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# (sheet, table, order). Sheet 4 is the second pass on ECA User (Reports To only).
ORDER = [('1 States', 'eca_state'), ('2 Store Location Types', 'eca_storelocationtype'), ('13 Competitors', 'eca_competitor'),
         ('3 ECA Users', 'eca_ecauser'), ('4 Reports To', 'eca_ecauser'), ('5 Channel Leads', 'eca_channellead'),
         ('6 Institutions', 'eca_institution'), ('7 Campuses', 'eca_campus'), ('8 Locations', 'eca_location'),
         ('9 Allocations', 'eca_allocation'), ('10 Audit Visits', 'eca_auditvisit'), ('11 Scoring Rule Set', 'eca_scoringruleset'),
         ('12 Distribution Settings', 'eca_distributionsettings')]
# Sheet headers that are not the column's display name.
HEADER_FIX = {'Allocation': {'Campus': 'eca_campustext'}}
PRIMARY_OF_SHEET = {'4 Reports To': 'Full Name'}
EMAIL_SHEET = '3 ECA Users'
NUM_RE = re.compile(r'^-?\d+(\.\d+)?$')


class Model:
    def __init__(self):
        self.schema = json.load(open(SCHEMA, encoding='utf-8'))
        self.tables = {t['logicalName']: t for t in self.schema['tables']}
        self.choices = {c['name']: {o['label']: o['value'] for o in c['options']} for c in self.schema['choices']}
        self.by_display = {n: t for n, t in ((t['displayName'], t) for t in self.schema['tables'])}

    def col(self, table, header):
        t = self.tables[table]
        fix = HEADER_FIX.get(t['displayName'], {}).get(header)
        for c in t['columns']:
            if c['displayName'] == header or c['displayName'].replace(' (legacy)', '') == header or c['logicalName'] == fix:
                return c
        return None


def read_sheets(path=PACK):
    wb = openpyxl.load_workbook(path, data_only=True)
    out = {}
    for name, _ in ORDER:
        rows = list(wb[name].iter_rows(values_only=True))
        hdr = [h for h in rows[0] if h]
        out[name] = [dict(zip(hdr, r)) for r in rows[1:] if any(v not in (None, '') for v in r)]
    return out


def convert(c, v, m):
    """Sheet value -> Dataverse JSON value (lookups are handled by the caller)."""
    if v is None or v == '':
        return None
    k = c['kind']
    if k == 'boolean':
        return {'Yes': True, 'No': False}[v] if isinstance(v, str) else bool(v)
    if k == 'choice':
        return m.choices[c['choiceSet']][v]
    if k in ('integer',):
        return int(v)
    if k in ('decimal', 'money'):
        return float(v)
    if k in ('date', 'datetime'):
        if isinstance(v, (date, datetime)):
            return v.strftime('%Y-%m-%d') if k == 'date' else v.isoformat() + 'Z'
        return str(v)[:10] if k == 'date' else str(v)
    return str(v)


def validate(sheets, m):
    """Offline checks. Returns (problems, warnings, counts)."""
    P, W = [], []
    names = lambda s, h: [r.get(h) for r in sheets[s]]
    for sheet, table in ORDER:
        for h in {h for r in sheets[sheet] for h in r}:
            c = m.col(table, h)
            if c is None:
                P.append('%s: header %r has no column in %s' % (sheet, h, table))
        prim = PRIMARY_OF_SHEET.get(sheet) or next(c['displayName'] for c in m.tables[table]['columns'] if c['primary'])
        vals = [r.get(prim) for r in sheets[sheet]]
        if any(v in (None, '') for v in vals):
            P.append('%s: blank %s' % (sheet, prim))
        dup = len(vals) - len(set(vals))
        if dup:
            P.append('%s: %d duplicate %s values (the primary-name key must be unique)' % (sheet, dup, prim))
    # required columns present and choice labels valid
    for sheet, table in ORDER:
        for i, r in enumerate(sheets[sheet], 2):
            for h, v in r.items():
                c = m.col(table, h)
                if not c:
                    continue
                if c['kind'] == 'choice' and v not in (None, '') and v not in m.choices[c['choiceSet']]:
                    P.append('%s row %d: %r is not a valid %s' % (sheet, i, h, c['choiceSet']))
                    break
    users = sheets['3 ECA Users']
    userset = {r['Full Name'] for r in users}
    states = {r['State Code'] for r in sheets['1 States']}
    insts = {r['Code'] for r in sheets['6 Institutions']}
    camps = {r['Campus Key'] for r in sheets['7 Campuses']}
    locs = {r['Location ID'] for r in sheets['8 Locations']}
    stypes = {r['Name'] for r in sheets['2 Store Location Types']}
    def ref(sheet, h, pool, label, skip_blank=True):
        bad = [r.get(h) for r in sheets[sheet] if r.get(h) not in pool and not (skip_blank and r.get(h) in (None, ''))]
        if bad:
            P.append('%s: %d %s not found (%s)' % (sheet, len(bad), label, h))
    ref('3 ECA Users', 'State', states, 'states')
    ref('4 Reports To', 'Full Name', userset, 'users')
    ref('4 Reports To', 'Reports To', userset, 'managers')
    ref('5 Channel Leads', 'Lead', userset, 'leads')
    ref('5 Channel Leads', 'State', states, 'states')
    ref('6 Institutions', 'State', states, 'states')
    ref('7 Campuses', 'Institution', insts, 'institutions')
    ref('8 Locations', 'Institution', insts, 'institutions')
    ref('8 Locations', 'Campus', camps, 'campuses')
    ref('8 Locations', 'Store Location Type', stypes, 'store types')
    ref('9 Allocations', 'Staff Member', userset, 'users')
    ref('9 Allocations', 'Institution', insts, 'institutions')
    ref('10 Audit Visits', 'Location', locs, 'locations')
    ref('10 Audit Visits', 'Institution', insts, 'institutions')
    ref('10 Audit Visits', 'Staff Member', userset, 'users')
    mgr = {r['Full Name'] for r in users if r['Role'] == 'Manager'}
    nm = [r['Reports To'] for r in sheets['4 Reports To'] if r.get('Reports To') and r['Reports To'] not in mgr]
    if nm:
        P.append('4 Reports To: %d reports-to values are not Managers' % len(nm))
    w = sum(r['Weight %s' % x] for r in sheets['11 Scoring Rule Set'] for x in ['Ranging', 'TDP', 'Editions', 'POS', 'Coolers'])
    if w != 100:
        P.append('11 Scoring Rule Set: weights total %s, must be 100' % w)
    cur = [r for r in sheets['11 Scoring Rule Set'] if r.get('Is Current') == 'Yes']
    if len(cur) != 1:
        P.append('11 Scoring Rule Set: exactly one row must be current')
    # expected counts from the handover
    exp = {'1 States': 5, '3 ECA Users': 102, '6 Institutions': 59, '8 Locations': 215, '10 Audit Visits': 103}
    for s, n in exp.items():
        if len(sheets[s]) != n:
            P.append('%s: expected %d rows, found %d' % (s, n, len(sheets[s])))
    roles = {x: sum(1 for r in users if r['Role'] == x) for x in ['Administrator', 'Manager', 'Student Marketeer']}
    if roles != {'Administrator': 16, 'Manager': 16, 'Student Marketeer': 70}:
        P.append('3 ECA Users: role split is %s, expected 16/16/70' % roles)
    # blockers the build pack flags for you to fix
    noemail = sum(1 for r in users if not r.get('Email'))
    if noemail:
        W.append('%d of %d users have no Email (needed for Microsoft sign-in and results emails; fill before go-live)' % (noemail, len(users)))
    sm_no_boss = sum(1 for r in users if r['Role'] == 'Student Marketeer') - len({r['Full Name'] for r in sheets['4 Reports To'] if r.get('Reports To')})
    if sm_no_boss > 0:
        W.append('%d Student Marketeers have no Reports To (the pack says the 8 VIC workbook staff have none yet)' % sm_no_boss)
    unconf = sum(1 for r in sheets['8 Locations'] if r.get('Type Confirmed') == 'No')
    W.append('%d locations still have Type Confirmed = No (store types were guessed from the workbook)' % unconf)
    counts = {s: len(sheets[s]) for s, _ in ORDER}
    return P, W, counts


def build_payload(m, table, row, sheet, sets):
    """Return (key_value, body). `sets` maps table -> entity set name (from the live environment)."""
    t = m.tables[table]
    body = {}
    primary_h = PRIMARY_OF_SHEET.get(sheet) or next(c['displayName'] for c in t['columns'] if c['primary'])
    for h, v in row.items():
        if h == primary_h and sheet != '4 Reports To':
            body['eca_name'] = str(v)
            continue
        if sheet == '4 Reports To':
            if h == 'Reports To' and v:
                body['eca_reportsto@odata.bind'] = '/%s(eca_name=%s)' % (sets['eca_ecauser'], qv(v))
            continue
        if v in (None, ''):
            continue
        c = m.col(table, h)
        if c['kind'] == 'lookup':
            tgt = 'systemuser' if c['target'] == 'systemuser' else m.by_display[c['target']]['logicalName']
            body['%s@odata.bind' % c['logicalName']] = '/%s(eca_name=%s)' % (sets[tgt], qv(v))
        else:
            body[c['logicalName']] = convert(c, v, m)
    return str(row[primary_h]), body


def qv(v):
    return "'" + str(v).replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--only', help='sheet number, e.g. 8')
    ap.add_argument('--pack', default=PACK)
    ap.add_argument('--emails', help='CSV with columns "Full Name,Email" to fill sheet 3 without editing the workbook (keep the CSV out of git)')
    a = ap.parse_args()
    m = Model()
    sheets = read_sheets(a.pack)
    if a.emails:
        import csv
        em = {r['Full Name'].strip(): r['Email'].strip() for r in csv.DictReader(open(a.emails, encoding='utf-8-sig'))}
        for r in sheets['3 ECA Users']:
            if em.get(r['Full Name']):
                r['Email'] = em[r['Full Name']]
        print('Emails supplied for %d users from %s' % (sum(1 for r in sheets['3 ECA Users'] if r.get('Email')), os.path.basename(a.emails)))
    P, W, counts = validate(sheets, m)
    print('Row counts:', ', '.join('%s=%d' % (k.split(' ')[0], v) for k, v in counts.items()))
    for w in W:
        print('WARNING:', w)
    for p in P:
        print('PROBLEM:', p)
    if P:
        print('%d problem(s). Fix the workbook, then re-run. Nothing was sent.' % len(P))
        return 1
    print('Validation passed (%d warning(s)).' % len(W))
    if not a.apply:
        print('Validate only. Re-run with --apply to load (set DATAVERSE_URL and DATAVERSE_TOKEN).')
        return 0
    from pp_deploy import Dv
    url, token = os.environ.get('DATAVERSE_URL'), os.environ.get('DATAVERSE_TOKEN')
    if not url or not token:
        print('Set DATAVERSE_URL and DATAVERSE_TOKEN first.', file=sys.stderr)
        return 2
    dv = Dv(url, token, os.environ.get('ECA_SOLUTION', m.schema['solution']))
    sets = {}
    for tn in list(m.tables) + ['systemuser']:
        code, text = dv.call('GET', "EntityDefinitions(LogicalName='%s')?$select=EntitySetName" % tn)
        if code != 200:
            print('Table %s not found (HTTP %s). Apply Stage 1 first.' % (tn, code), file=sys.stderr)
            return 2
        sets[tn] = json.loads(text)['EntitySetName']
    for sheet, table in ORDER:
        if a.only and sheet.split(' ')[0] != a.only:
            continue
        ok = 0
        for row in sheets[sheet]:
            key, body = build_payload(m, table, row, sheet, sets)
            if sheet == '4 Reports To' and not body:
                continue
            path = '%s(eca_name=%s)' % (sets[table], qv(key))
            code, text = dv.call('PATCH', path, body)  # upsert on alternate key
            if code >= 300:
                print('FAILED %s row %r: HTTP %s %s' % (sheet, key if table != 'eca_ecauser' else '(user)', code, text[:300]), file=sys.stderr)
                return 1
            ok += 1
        print('loaded %-26s %d rows' % (sheet, ok))
    return 0


if __name__ == '__main__':
    sys.exit(main())
