"""Parity and file checks for the audit export. Python build_export must match the prototype's auditExportWorkbook
(sheets, rows, dashboard cells, chart definitions); write_xlsx must produce a real workbook with 9 native charts. Synthetic data only."""
import json, os, random, re, subprocess, sys, tempfile, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
sys.path.insert(0, HERE)
import pp_export as X
import pp_monthly as M
import test_monthly as TM

GEN = '13 Oct 2026, 6:00 pm'


def fixture(seed, **kw):
    fx = TM.fixture(seed, **kw)
    r = random.Random(seed + 999)
    names = ['Campus Bar', 'Union Pub', 'Juice Bar', 'Noodle House', 'Hotel Cafe', 'Coffee Bar', 'Sushi Express', 'Tavern 21']
    for l in fx['locations']:
        l['name'] = r.choice(names) + ' %s' % l['id']
        l['indNka'] = r.choice([None, None, 'NKA', 'IND'])
        if r.random() < 0.3: l['storeType'] = r.choice(['QSR', 'Student Bar', 'Convenience', 'NKA'])
    for v in fx['visits']:
        v['ranging'] = {**(v.get('ranging') or {}), **{k: r.choice([1, 0]) for k in ('monsterUltra', 'vsf', 'vblue', 'solo')}} if v.get('ranging') else v.get('ranging')
        v['response'] = {'price': r.choice(['', None, 3.5, '4.2', 0]), 'comp': r.choice(['', 'Monster', 'V', 'None']), 'compPrice': r.choice(['', None, 3.0]),
                         'pos': r.choice([1, 0, None, '1']), 'cooler': r.choice([1, 0, None]), 'bull': r.choice(['', 'EYE', 'RING']),
                         'channel': r.choice(['', 'OnP', 'OffP']), 'classification': r.choice(['', 'A', 'B']), 'vendCo': r.choice(['', 'Vendy']), 'machineId': r.choice(['', 'M-1'])}
        if v.get('compFacings') is not None:
            v['compDetail'] = {b: {'price': r.choice([None, '', 3.25, 4]), 'pos': r.choice([0, 1, 2]), 'coolers': r.choice([0, 1, 2])} for b in v['compFacings']}
        v.update({'contactName': r.choice(['', 'Sam']), 'contactRole': r.choice(['', 'Owner']), 'flavours': r.choice(['', 'Peach']), 'posType': r.choice(['', 'Wobbler']),
                  'notes': r.choice(['', 'Busy store']), 'nextStep': r.choice(['', 'Return Friday']), 'followUp': r.choice(['', '2026-10-01']),
                  'submittedBy': r.choice(['', v.get('staff') or '']), 'approvedBy': r.choice(['', 'Mgr VIC']), 'demo': r.random() < 0.1})
    return fx


def run_js(fx, states):
    out = subprocess.run(['node', os.path.join(HERE, 'export_js.js')], input=json.dumps({**fx, 'exportStates': states}), capture_output=True, text=True)
    if out.returncode:
        raise RuntimeError(out.stderr)
    return json.loads(out.stdout)


def norm(o):
    """Replace the generation timestamp (real clock in JS, fixed in Python) so the two can be compared."""
    t = json.dumps(o, ensure_ascii=False)
    t = re.sub(r'Generated [^"]*? by Test User', 'Generated X by Test User', t)
    t = re.sub(r'generated [^"]*? · Education', 'generated X · Education', t)
    return json.loads(t)


def py_model(fx, states):
    m = X.build_export(fx, fx['month'], states, 'Test User', GEN)
    return norm(json.loads(json.dumps(m)))


def eq(tc, a, b, msg=''):
    """Deep equality; floats may differ in the last digits (summation order)."""
    if isinstance(a, dict) and isinstance(b, dict):
        tc.assertEqual(sorted(a), sorted(b), msg)
        for k in a: eq(tc, a[k], b[k], '%s.%s' % (msg, k))
    elif isinstance(a, list) and isinstance(b, list):
        tc.assertEqual(len(a), len(b), msg)
        for i, (x, y) in enumerate(zip(a, b)): eq(tc, x, y, '%s[%d]' % (msg, i))
    elif isinstance(a, float) or isinstance(b, float):
        if a is None or b is None or isinstance(a, str) or isinstance(b, str): tc.assertEqual(a, b, msg)
        else: tc.assertAlmostEqual(a, b, places=9, msg=msg)
    else:
        tc.assertEqual(a, b, msg)


def compare(tc, js, py, label=''):
    js = norm(js)
    tc.assertEqual(js['filename'], py['filename'], label)
    tc.assertEqual([s['name'] for s in js['sheets']], [s['name'] for s in py['sheets']], label)
    for a, b in zip(js['sheets'], py['sheets']):
        for k in ('title', 'notes', 'header', 'widths', 'merges', 'heights', 'noGrid', 'raw'):
            tc.assertEqual(a.get(k), b.get(k), '%s %s.%s' % (label, a['name'], k))
        ra, rb = a.get('rows'), b.get('rows')
        tc.assertEqual(len(ra or []), len(rb or []), '%s %s rows' % (label, a['name']))
        for i, (x, y) in enumerate(zip(ra or [], rb or [])):
            tc.assertEqual(x['bold'], y['bold'])
            tc.assertEqual(len(x['cells']), len(y['cells']))
            for j, (p, q) in enumerate(zip(x['cells'], y['cells'])):
                eq(tc, p, q, '%s %s r%d c%d (%s)' % (label, a['name'], i, j, (a.get('header') or [''] * 99)[j]))
        if a.get('cells') is not None:
            tc.assertEqual(len(a['cells']), len(b['cells']), '%s %s cell rows' % (label, a['name']))
            for i, (x, y) in enumerate(zip(a['cells'], b['cells'])):
                eq(tc, x, y, '%s %s cell row %d' % (label, a['name'], i))
        eq(tc, a.get('charts'), b.get('charts'), '%s %s charts' % (label, a['name']))


class T(unittest.TestCase):
    def test_parity_all_states_closed_month(self):
        for seed in range(6):
            fx = fixture(seed)
            compare(self, run_js(fx, ['VIC', 'NSW', 'QLD', 'SA']), py_model(fx, ['VIC', 'NSW', 'QLD', 'SA']), 'seed%d' % seed)

    def test_parity_single_state(self):
        for seed in range(10, 16):
            fx = fixture(seed)
            st = ['VIC', 'NSW', 'QLD', 'SA'][seed % 4]
            compare(self, run_js(fx, [st]), py_model(fx, [st]), 'seed%d %s' % (seed, st))

    def test_parity_month_to_date_and_other_months(self):
        for seed, today, month in ((20, '2026-09-17', '2026-09'), (21, '2026-10-13', '2026-10'), (22, '2026-10-13', '2026-08')):
            fx = fixture(seed, today=today, month=month)
            compare(self, run_js(fx, ['VIC', 'NSW']), py_model(fx, ['VIC', 'NSW']), 'seed%d' % seed)
            compare(self, run_js(fx, ['SA']), py_model(fx, ['SA']), 'seed%d SA' % seed)

    def test_parity_sparse_and_empty(self):
        for seed in range(30, 34):
            fx = fixture(seed, n_visits=8)
            compare(self, run_js(fx, ['VIC', 'NSW', 'QLD', 'SA']), py_model(fx, ['VIC', 'NSW', 'QLD', 'SA']), 'sparse%d' % seed)
            compare(self, run_js(fx, ['QLD']), py_model(fx, ['QLD']), 'sparse%d QLD' % seed)
        fx = fixture(1); fx['visits'] = []
        compare(self, run_js(fx, ['VIC', 'NSW']), py_model(fx, ['VIC', 'NSW']), 'empty')
        compare(self, run_js(fx, ['VIC']), py_model(fx, ['VIC']), 'empty VIC')

    def test_labels_and_products_match_prototype(self):
        js = json.loads(subprocess.run(['node', os.path.join(HERE, 'export_js.js'), 'products'], capture_output=True, text=True).stdout)
        self.assertEqual({p['key']: p['label'] for p in js}, X.LABELS)

    def test_workbook_file(self):
        from openpyxl import load_workbook
        fx = fixture(3)
        model = X.build_export(fx, fx['month'], ['VIC', 'NSW'], 'Test User', GEN)
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, model['filename'])
            X.write_xlsx(model, path)
            wb = load_workbook(path)
            self.assertEqual(wb.sheetnames, ['Dashboard', 'Summary', 'VIC audits', 'NSW audits', 'Chart data'])
            dash = wb['Dashboard']
            self.assertEqual(len(dash._charts), 9)
            self.assertEqual(len(wb['VIC audits'][5]), 61)  # header row: title, note, blank, then header at row 4 -> checked below
            vic = wb['VIC audits']
            hdr = [c.value for c in vic[4]]
            self.assertEqual(len(hdr), 61)
            self.assertEqual(hdr[0], 'Audit ID')
            n_vic = len([s for s in model['sheets'] if s['name'] == 'VIC audits'][0]['rows'])
            self.assertEqual(vic.max_row, 4 + n_vic)
            self.assertEqual(vic.freeze_panes, 'A5')
            self.assertTrue(vic.auto_filter.ref.startswith('A4:'))
            self.assertEqual(wb['Summary']['A1'].value.startswith('ECA audit export'), True)
            self.assertEqual(dash['A5'].value in (None, ''), False)  # KPI value row
            self.assertEqual(dash['A2'].font.name, 'Arial')
            cd = wb['Chart data']
            for ch in dash._charts:
                for s in ch.series:
                    self.assertIn('Chart data', s.val.numRef.f)

    def test_command_line(self):
        fx = fixture(8)
        with tempfile.TemporaryDirectory() as td:
            dp = os.path.join(td, 'd.json')
            json.dump({**fx, 'by': 'Test'}, open(dp, 'w'))
            self.assertEqual(X.main([dp, fx['month'], 'VIC,NSW', td]), 0)
            self.assertTrue(os.path.exists(os.path.join(td, 'ECA audit export 2026-09 all states.xlsx')))
            self.assertEqual(X.main([]), 2)

    def test_summary_total_row_only_for_multiple_states(self):
        fx = fixture(5)
        multi = py_model(fx, ['VIC', 'NSW'])['sheets'][1]['rows']
        single = py_model(fx, ['VIC'])['sheets'][1]['rows']
        self.assertTrue(multi[-1]['bold'] and multi[-1]['cells'][0] == 'All states')
        self.assertFalse(any(r['bold'] for r in single))


if __name__ == '__main__':
    unittest.main()
