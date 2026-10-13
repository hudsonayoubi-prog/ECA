"""Parity: the Python scoring port must match the prototype's scoreMonth on the same data. Synthetic data only."""
import json, os, random, subprocess, sys, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
import pp_scoring as S

RULES = {'weights': {'ranging': 30, 'tdp': 25, 'editions': 20, 'pos': 15, 'coolers': 10}, 'method': 'relative',
         'targets': {'tdp': 12, 'editions': 8, 'pos': 10, 'coolers': 2}, 'minAudits': 3}
MONTH = '2026-09'


def run_js(fx):
    out = subprocess.run(['node', os.path.join(HERE, 'score_js.js')], input=json.dumps(fx), capture_output=True, text=True)
    if out.returncode:
        raise RuntimeError(out.stderr)
    return json.loads(out.stdout)


def fixture(seed, rules=RULES, n_people=9, n_visits=140):
    r = random.Random(seed)
    people = [{'id': 'p%d' % i, 'name': 'Marketeer %02d' % i, 'role': 'marketeer', 'state': 'VIC',
               'status': r.choice(['Active'] * 5 + ['Inactive']), 'reportsTo': 'Boss'} for i in range(n_people)]
    people.append({'id': 'm1', 'name': 'Manager One', 'role': 'manager', 'state': 'VIC', 'status': 'Active'})
    locs = [{'id': 'L%02d' % i, 'type': r.choice(['QSR', 'QSR', 'Vending'])} for i in range(25)]
    visits = []
    for i in range(n_visits):
        p = r.choice(people[:n_people])
        rg = r.choice([None, {}, {k: r.choice([1, 0, None, '1']) for k in ('ed', 'sf', 'zero', 'editions', 'monster')}])
        visits.append({'id': 'V%d' % i, 'loc': r.choice(locs + [{'id': 'GONE'}])['id'], 'staff': p['name'],
                       'staffId': r.choice([p['id'], p['id'], None]), 'status': r.choice(['Completed'] * 6 + ['Scheduled', 'Cancelled']),
                       'approval': r.choice([None, 'Approved', 'Approved', 'Pending', 'Rejected', 'Duplicate']),
                       'imported': r.random() < 0.05, 'date': '2026-%s-%02d' % (r.choice(['09'] * 8 + ['08', '10']), r.randint(1, 28)),
                       'time': r.choice([None, '09:30', '14:05']), 'dpAdded': r.randint(0, 6), 'editions': r.randint(0, 5),
                       'posPlaced': r.randint(0, 4), 'coolersIn': r.randint(0, 2), 'ranging': rg,
                       'approvedAt': r.choice([None, '2026-09-%02dT10:00:00Z' % r.randint(1, 28)]),
                       'submittedAt': '2026-09-%02dT08:00:00Z' % r.randint(1, 28)})
    return {'month': MONTH, 'rules': rules, 'people': people, 'locations': locs, 'visits': visits}


def compare(tc, js, py):
    tc.assertEqual([r['id'] for r in js['rows']], [r['id'] for r in py['rows']], 'row order / ranking differs')
    for a, b in zip(js['rows'], py['rows']):
        for k in ('rank', 'qualified', 'audits', 'locations', 'tdp', 'editions', 'pos', 'coolers', 'pending', 'excluded', 'lastAt', 'total'):
            tc.assertEqual(a.get(k), b.get(k), '%s %s' % (a['id'], k))
        tc.assertAlmostEqual(a['ranging'], b['ranging'], places=9)
        for m in S.MEASURES:
            tc.assertAlmostEqual(a['scores'][m], b['scores'][m], places=9)
            tc.assertAlmostEqual(a['points'][m], b['points'][m], places=9)
    tc.assertEqual((js['counted'], js['pending'], js['excluded'], js['lastUpdated']),
                   (len(py['counted']), len(py['pending']), len(py['excluded']), py['lastUpdated']))


class T(unittest.TestCase):
    def py(self, fx):
        return S.score_month(fx['visits'], fx['people'], fx['locations'], fx['rules'], fx['month'])

    def test_products_match_prototype(self):
        js = json.loads(subprocess.run(['node', os.path.join(HERE, 'score_js.js'), 'products'], capture_output=True, text=True).stdout)
        rb = [(p['key'], p['qsr'], p['vending']) for p in js if not p.get('competitor')]
        self.assertEqual(rb, S.PRODUCTS)

    def test_parity_relative_many_seeds(self):
        for seed in range(25):
            fx = fixture(seed)
            compare(self, run_js(fx), self.py(fx))

    def test_parity_target_method(self):
        for seed in range(100, 110):
            fx = fixture(seed, rules={**RULES, 'method': 'target'})
            compare(self, run_js(fx), self.py(fx))

    def test_parity_odd_weights_and_min_audits(self):
        for seed, w, m in ((200, {'ranging': 50, 'tdp': 50, 'editions': 0, 'pos': 0, 'coolers': 0}, 1),
                           (201, {'ranging': 7, 'tdp': 13, 'editions': 17, 'pos': 19, 'coolers': 23}, 2),
                           (202, {'ranging': 0, 'tdp': 0, 'editions': 0, 'pos': 0, 'coolers': 0}, 1)):
            fx = fixture(seed, rules={**RULES, 'weights': w, 'minAudits': m})
            compare(self, run_js(fx), self.py(fx))

    def test_parity_ties(self):
        # identical audits for everyone: ties fall through to last approval, then name
        people = [{'id': 'p%d' % i, 'name': n, 'role': 'marketeer', 'state': 'VIC', 'status': 'Active'} for i, n in enumerate(['Zed', 'Amy', 'Bob'])]
        visits = [{'id': '%s%d' % (p['id'], k), 'loc': 'L%d' % k, 'staff': p['name'], 'staffId': p['id'], 'status': 'Completed', 'approval': 'Approved',
                   'imported': False, 'date': '2026-09-0%d' % (k + 1), 'dpAdded': 2, 'editions': 1, 'posPlaced': 1, 'coolersIn': 0,
                   'ranging': {'ed': 1, 'sf': 1}, 'approvedAt': '2026-09-1%d' % (2 if p['name'] == 'Bob' else 5)} for p in people for k in range(3)]
        fx = {'month': MONTH, 'rules': RULES, 'people': people, 'locations': [{'id': 'L%d' % k, 'type': 'QSR'} for k in range(3)], 'visits': visits}
        js, py = run_js(fx), self.py(fx)
        compare(self, js, py)
        self.assertEqual([r['name'] for r in py['rows']], ['Bob', 'Amy', 'Zed'])  # Bob approved earliest; then name order

    def test_rules(self):
        fx = fixture(7)
        res = self.py(fx)
        q = [r for r in res['rows'] if r['qualified']]
        self.assertTrue(all(r['audits'] >= 3 for r in q))
        self.assertTrue(all(r['rank'] is None and r['total'] == 0 for r in res['rows'] if not r['qualified']))
        self.assertEqual([r['rank'] for r in q], list(range(1, len(q) + 1)))
        self.assertTrue(all(0 <= r['total'] <= 100 for r in res['rows']))
        # imported and unapproved audits never count
        self.assertEqual(sum(r['audits'] for r in res['rows']), len([v for v in res['counted']]))

    def test_snapshot_and_dataverse_adapters(self):
        fx = fixture(3)
        rows = S.snapshot_rows(self.py(fx)['rows'])
        self.assertEqual(len(rows), len(self.py(fx)['rows']))
        self.assertIn('eca_totalscore', rows[0])
        rules = S.rules_from_dataverse({'eca_wranging': 30, 'eca_wtdp': 25, 'eca_weditions': 20, 'eca_wpos': 15, 'eca_wcoolers': 10,
                                        'eca_normalisation': 'Relative to leader', 'eca_ttdp': 12, 'eca_teditions': 8, 'eca_tpos': 10,
                                        'eca_tcoolers': 2, 'eca_minaudits': 3})
        self.assertEqual(rules, RULES)
        v = S.visit_from_dataverse({'eca_name': 'X-V1', 'eca_visitstatus': 'Completed', 'eca_visitdate': '2026-09-01', 'eca_rangingjson': '{"ed":1}'}, 'u', 'U', 'L1')
        self.assertEqual(v['ranging'], {'ed': 1})


if __name__ == '__main__':
    unittest.main()
