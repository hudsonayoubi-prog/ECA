"""Offline checks for the Power Platform schema generator and deploy plan. Run: python3 -m unittest discover -s tests/pp"""
import json, os, sys, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
import pp_schema, pp_deploy


class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = pp_schema.build()

    def test_counts_match_build_pack(self):
        self.assertEqual(len(self.schema['tables']), 21)
        self.assertEqual(sum(len(t['columns']) for t in self.schema['tables']), 253)  # 238 in the workbook + 15 in schema/extensions.json

    def test_committed_json_is_current(self):
        committed = json.load(open(os.path.join(ROOT, 'docs/power-platform/schema/eca-schema.json'), encoding='utf-8'))
        self.assertEqual(committed, json.loads(json.dumps(self.schema)), 'run: python3 scripts/pp_schema.py')

    def test_all_names_are_prefixed_and_short(self):
        for t in self.schema['tables']:
            self.assertTrue(t['logicalName'].startswith('eca_'))
            for c in t['columns']:
                self.assertRegex(c['logicalName'], r'^eca_[a-z0-9_]{1,40}$')

    def test_key_columns(self):
        loc = next(t for t in self.schema['tables'] if t['logicalName'] == 'eca_location')
        cols = {c['logicalName']: c for c in loc['columns']}
        self.assertEqual(cols['eca_visitcycledays']['default'], 14)  # note: parsed default
        self.assertEqual((cols['eca_visitcycledays']['min'], cols['eca_visitcycledays']['max']), (1, 365))
        self.assertEqual(cols['eca_contactphone']['format'], 'Phone')
        self.assertEqual(cols['eca_rg_ed']['choiceSet'], 'Yes / No')

    def test_weights_choice_values_unique(self):
        for cs in self.schema['choices']:
            vals = [o['value'] for o in cs['options']]
            self.assertEqual(len(vals), len(set(vals)))

    def test_plan_order_and_shape(self):
        steps = pp_deploy.plan(self.schema)
        kinds = [s[0] for s in steps]
        self.assertLess(max(i for i, k in enumerate(kinds) if k == 'choice'), min(i for i, k in enumerate(kinds) if k == 'table'))
        self.assertLess(max(i for i, k in enumerate(kinds) if k == 'table'), min(i for i, k in enumerate(kinds) if k == 'column'))
        self.assertEqual(kinds.count('table'), 21)
        json.dumps([s[4] for s in steps])  # serialisable
        vc = [s for s in steps if s[0] == 'lookup' and s[1] == 'eca_visitcompetitor.eca_auditvisit'][0]
        self.assertEqual(vc[4]['CascadeConfiguration']['Delete'], 'Cascade')

    def test_dry_run_touches_no_network(self):
        import subprocess
        out = subprocess.run([sys.executable, os.path.join(ROOT, 'scripts/pp_deploy.py')], capture_output=True, text=True, env={'PATH': os.environ['PATH']})
        self.assertEqual(out.returncode, 0)
        self.assertIn('Dry run only', out.stdout)

    def test_security_model_references_real_tables(self):
        sec = json.load(open(os.path.join(ROOT, 'docs/power-platform/security/security-model.json')))
        real = {t['logicalName'] for t in self.schema['tables']}
        for role, grants in sec['roles'].items():
            for k in grants:
                for name in k.split(','):
                    if name.startswith('eca_'):
                        self.assertIn(name, real, role + ': ' + name)
        for col in sec['columnSecurity']['columns']:
            t, c = col.split('.')
            self.assertIn(c, {x['logicalName'] for tb in self.schema['tables'] if tb['logicalName'] == t for x in tb['columns']})


if __name__ == '__main__':
    unittest.main()
