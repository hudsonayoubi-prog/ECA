"""Parity: Python monthly summaries must match the prototype's stateMonthly / nationalMonthly. Synthetic data only."""
import json, os, random, subprocess, sys, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
import pp_monthly as M

RULES = {'weights': {'ranging': 30, 'tdp': 25, 'editions': 20, 'pos': 15, 'coolers': 10}, 'method': 'relative',
         'targets': {'tdp': 12, 'editions': 8, 'pos': 10, 'coolers': 2}, 'minAudits': 3}
STATES = [{'code': c, 'name': n} for c, n in (('VIC', 'Victoria'), ('NSW', 'New South Wales'), ('QLD', 'Queensland'), ('SA', 'South Australia'))]
BRANDS = ['Monster', 'V', 'Solo Energy', 'Rockstar']


def fixture(seed, today='2026-10-13', month='2026-09', n_visits=260, states=None):
    r = random.Random(seed)
    unis = []
    for i in range(9):
        st = ['VIC', 'VIC', 'VIC', 'NSW', 'NSW', 'QLD', 'QLD', 'SA', 'VIC'][i]
        unis.append({'code': 'U%d' % i, 'name': 'Uni %02d' % i, 'short': 'U%d' % i if i % 2 else None, 'kind': r.choice(['University', 'TAFE']),
                     'state': st, 'status': 'Removed' if i == 8 else 'Active'})
    locs = [{'id': 'L%03d' % i, 'uni': r.choice(unis)['code'], 'campus': 'C', 'name': 'Store %d' % i, 'type': r.choice(['QSR', 'QSR', 'Vending']),
             'status': r.choice(['Active'] * 5 + ['Inactive', 'Removed'])} for i in range(60)]
    people = []
    for st in ('VIC', 'NSW', 'QLD', 'SA'):
        people.append({'id': 'm' + st, 'name': 'Mgr ' + st, 'role': 'manager', 'state': st, 'status': 'Active'})
        people.append({'id': 'a' + st, 'name': 'Lead ' + st, 'role': 'manager', 'state': st, 'status': r.choice(['Active', 'Inactive'])})
        for k in range(r.randint(2, 5)):
            people.append({'id': 's%s%d' % (st, k), 'name': 'SM %s %d' % (st, k), 'role': 'marketeer', 'state': st,
                           'status': r.choice(['Active'] * 4 + ['Inactive']), 'reportsTo': 'Mgr ' + st})
    people += [{'id': 'ad%d' % i, 'name': 'Admin %d' % i, 'role': 'admin', 'state': None, 'status': r.choice(['Active', 'Active', 'Inactive'])} for i in range(3)]
    sms = [p for p in people if p['role'] == 'marketeer']
    visits = []
    for i in range(n_visits):
        p = r.choice(sms)
        withf = r.random() < 0.6
        v = {'id': 'V%d' % i, 'loc': r.choice(locs + [{'id': 'GONE'}])['id'], 'staff': r.choice([p['name'], p['name'], None]), 'staffId': p['id'],
             'status': r.choice(['Completed'] * 6 + ['Scheduled', 'Cancelled']), 'approval': r.choice([None, 'Approved', 'Approved', 'Pending', 'Rejected', 'Duplicate']),
             'imported': r.random() < 0.05, 'date': '2026-%s-%02d' % (r.choice(['09'] * 8 + ['08', '10']), r.randint(1, 13 if r.random() < 0.3 else 28)),
             'time': r.choice([None, '09:30', '14:05']), 'dpAdded': r.randint(0, 6), 'dpLost': r.randint(0, 2), 'editions': r.randint(0, 5),
             'posPlaced': r.randint(0, 4), 'coolersIn': r.randint(0, 2), 'coolersOut': r.randint(0, 1),
             'ranging': r.choice([None, {}, {k: r.choice([1, 0, None, '1', '0']) for k in ('ed', 'sf', 'zero', 'editions', 'monster', 'v')}]),
             'approvedAt': r.choice([None, '2026-09-%02dT10:00:00Z' % r.randint(1, 28)]), 'submittedAt': '2026-09-%02dT08:00:00Z' % r.randint(1, 28),
             'issue': r.choice(['', '', '', 'Fridge broken']), 'compPos': r.choice([None, 0, 1, 3]), 'compCoolers': r.choice([None, 0, 1])}
        if withf:
            v['rbFacings'] = r.randint(0, 12)
            v['compFacings'] = {b: r.randint(0, 8) for b in r.sample(BRANDS, r.randint(0, 3))}
        else:
            v['rbFacings'] = None
        visits.append(v)
    leads = {'VIC': ['Lead VIC', 'Nobody'], 'NSW': ['Lead NSW'], 'QLD': [], 'SA': ['Mgr SA']}
    return {'today': today, 'month': month, 'rules': RULES, 'states': STATES, 'unis': unis, 'locations': locs, 'people': people, 'visits': visits, 'leads': leads}


def run_js(fx):
    out = subprocess.run(['node', os.path.join(HERE, 'monthly_js.js')], input=json.dumps(fx), capture_output=True, text=True)
    if out.returncode:
        raise RuntimeError(out.stderr)
    return json.loads(out.stdout)


def slim(x):
    keys = ('audits pending excluded active visited coverage dpAdded dpLost net editions pos coolersIn coolersOut issues auditors share rbFacings '
            'compFacings shelfLocs ranging compPos compCoolers').split()
    o = {k: x[k] for k in keys}
    o['brands'], o['present'], o['locs'] = x['ex']['brands'], x['ex']['present'], len(x['locs'])
    return o


def top(t):
    return [{'id': r['id'], 'rank': r['rank'], 'total': r['total']} for r in t]


def close(tc, a, b, path=''):
    if isinstance(a, dict):
        tc.assertEqual(sorted(a), sorted(b), path)
        for k in a:
            close(tc, a[k], b[k], path + '.' + k)
    elif isinstance(a, list):
        tc.assertEqual(len(a), len(b), path)
        for i, (x, y) in enumerate(zip(a, b)):
            close(tc, x, y, '%s[%d]' % (path, i))
    elif isinstance(a, float) or isinstance(b, float):
        if a is None or b is None:
            tc.assertEqual(a, b, path)
        else:
            tc.assertAlmostEqual(a, b, places=9, msg=path)
    else:
        tc.assertEqual(a, b, path)


def py_out(fx):
    d = dict(fx)
    out = {'state': {}}
    for st in fx['states']:
        r = M.state_monthly(d, fx['month'], st['code'])
        out['state'][st['code']] = {'x': slim(r['x']), 'top': top(r['top']), 'highlights': r['highlights'], 'to': r['to'],
            'insts': [{'code': i['u']['code'], **{k: i[k] for k in ('active', 'visited', 'coverage', 'audits', 'net', 'editions', 'pos')}} for i in r['insts']],
            'sms': [{'id': m['p']['id'], **{k: m[k] for k in ('audits', 'locations', 'net', 'editions', 'pos', 'coolers', 'last')}} for m in r['sms']]}
    n = M.national_monthly(d, fx['month'])
    out['national'] = {'x': slim(n['x']), 'top': top(n['top']), 'highlights': n['highlights'], 'to': n['to'],
        'states': [{'code': r['st']['code'], 'audits': r['y']['audits'], 'coverage': r['y']['coverage'], 'share': r['y']['share'], 'sms': r['sms'],
                    'activeSms': r['activeSms'], 'insts': r['insts'], 'managers': r['managers']} for r in n['states']]}
    return out


class T(unittest.TestCase):
    def test_parity_closed_months(self):
        for seed in range(12):
            fx = fixture(seed)
            close(self, run_js(fx), py_out(fx), 'seed%d' % seed)

    def test_parity_current_month_to_date(self):
        for seed in range(30, 36):
            fx = fixture(seed, today='2026-09-17', month='2026-09')
            close(self, run_js(fx), py_out(fx), 'seed%d' % seed)

    def test_parity_other_months(self):
        for seed, m in ((50, '2026-08'), (51, '2026-10'), (52, '2025-12')):
            fx = fixture(seed, month=m)
            close(self, run_js(fx), py_out(fx), 'seed%d' % seed)

    def test_empty_state_and_no_audits(self):
        fx = fixture(1)
        fx['visits'] = []
        js = run_js(fx)
        close(self, js, py_out(fx))
        self.assertIn('No audits this month', ' '.join(js['national']['highlights']))

    def test_sparse_data_matches_and_exercises_idle_paths(self):
        found = set()
        needles = ('No audits at', 'completed audits', 'No audit locations', 'No audits this month', 'with none', 'Most audits')
        for seed in range(40, 52):
            fx = fixture(seed, n_visits=12)
            if seed % 3 == 0:
                fx['locations'] = [l for l in fx['locations'] if l['uni'] not in ('U7',)]  # SA has no locations
            js = run_js(fx)
            py = py_out(fx)
            close(self, js, py, 'seed%d' % seed)
            text = ' '.join(py['national']['highlights'] + [h for s in py['state'].values() for h in s['highlights']])
            found |= {n for n in needles if n in text}
        self.assertEqual(found, set(needles), 'highlight paths not exercised: %s' % (set(needles) - found))

    def test_dense_data_exercises_main_highlights(self):
        found = set()
        needles = ('Most active', 'Share of shelf', 'ranging', 'flagged', 'awaiting approval', 'Best coverage', 'Best share of shelf')
        for seed in range(6):
            py = py_out(fixture(seed))
            text = ' '.join(py['national']['highlights'] + [h for s in py['state'].values() for h in s['highlights']])
            found |= {n for n in needles if n in text}
        self.assertEqual(found, set(needles))

    def test_rules(self):
        fx = fixture(2)
        s = M.state_monthly(fx, '2026-09', 'VIC')
        self.assertTrue(all(v.get('approval') not in ('Rejected', 'Duplicate') for v in s['x']['vs']))
        self.assertLessEqual(s['x']['visited'], s['x']['active'])
        self.assertEqual(M.summary_months('2026-10-13'), ['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05'])
        row = M.report_row(s)
        self.assertEqual((row['eca_reporttype'], row['eca_generatedon']), ('State summary', '2026-10-01T08:00:00'))
        self.assertEqual(M.report_row(M.national_monthly(fx, '2026-12'))['eca_generatedon'], '2027-01-01T08:00:00')

    def test_products_match_prototype(self):
        js = subprocess.run(['node', os.path.join(HERE, 'score_js.js'), 'products'], capture_output=True, text=True)
        prods = json.loads(js.stdout)
        self.assertEqual([(p['key'], p['qsr'], p['vending'], bool(p.get('competitor'))) for p in prods], M.PRODUCTS)


if __name__ == '__main__':
    unittest.main()
