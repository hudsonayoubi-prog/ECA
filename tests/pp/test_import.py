"""Offline checks for scripts/pp_import.py. Uses the build pack's data but prints/asserts only counts and shapes."""
import copy, os, sys, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
import pp_import as I


class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = I.Model()
        cls.sheets = I.read_sheets()
        cls.sets = {t: t + 's' for t in cls.m.tables}
        cls.sets['systemuser'] = 'systemusers'

    def test_pack_validates(self):
        problems, warnings, counts = I.validate(self.sheets, self.m)
        self.assertEqual(problems, [])
        self.assertEqual(counts['8 Locations'], 215)
        self.assertEqual(counts['3 ECA Users'], 102)

    def test_every_row_builds_a_payload(self):
        n = 0
        for sheet, table in I.ORDER:
            for row in self.sheets[sheet]:
                key, body = I.build_payload(self.m, table, row, sheet, self.sets)
                self.assertTrue(key)
                if sheet != '4 Reports To':
                    self.assertEqual(body['eca_name'], key)
                n += 1
        self.assertEqual(n, sum(len(v) for v in self.sheets.values()))

    def test_location_payload_types(self):
        row = self.sheets['8 Locations'][0]
        _, b = I.build_payload(self.m, 'eca_location', row, '8 Locations', self.sets)
        self.assertIsInstance(b['eca_visitcycledays'], int)
        self.assertIsInstance(b['eca_typeconfirmed'], bool)
        self.assertRegex(b['eca_dateadded'], r'^\d{4}-\d{2}-\d{2}$')
        self.assertIn("eca_institution@odata.bind", b)
        self.assertIn("eca_campus@odata.bind", b)
        self.assertTrue(b['eca_storelocationtype@odata.bind'].startswith('/eca_storelocationtypes(eca_name='))

    def test_visit_history_is_imported_and_unscored(self):
        for row in self.sheets['10 Audit Visits']:
            _, b = I.build_payload(self.m, 'eca_auditvisit', row, '10 Audit Visits', self.sets)
            self.assertIs(b['eca_imported'], True)
            self.assertNotIn('eca_staffmember@odata.bind', b)

    def test_validation_catches_bad_data(self):
        bad = copy.deepcopy(self.sheets)
        bad['8 Locations'][0]['Campus'] = 'NOPE – Nowhere'
        bad['8 Locations'][1]['Location ID'] = bad['8 Locations'][2]['Location ID']
        bad['3 ECA Users'][0]['Role'] = 'Wizard'
        bad['11 Scoring Rule Set'][0]['Weight POS'] = 99
        problems, _, _ = I.validate(bad, self.m)
        text = ' | '.join(problems)
        for needle in ['campuses not found', 'duplicate', 'not a valid ECA Role', 'weights total']:
            self.assertIn(needle, text)

    def test_apostrophe_escaping(self):
        self.assertEqual(I.qv("O'Brien"), "'O''Brien'")


if __name__ == '__main__':
    unittest.main()
