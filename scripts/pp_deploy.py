"""Create the ECA tables, columns, choices and relationships in a Dataverse environment.

Reads docs/power-platform/schema/eca-schema.json (made by scripts/pp_schema.py) and calls the
Dataverse Web API. DRY RUN BY DEFAULT: it prints what it would create and touches nothing.

  python3 scripts/pp_deploy.py                      # dry run, prints the plan
  python3 scripts/pp_deploy.py --apply              # create what is missing (idempotent)

Environment variables (never put these in code or git):
  DATAVERSE_URL    e.g. https://orgxxxx.crm6.dynamics.com   (the Dev environment)
  DATAVERSE_TOKEN  a bearer token, e.g.  az account get-access-token --resource $DATAVERSE_URL --query accessToken -o tsv
  ECA_SOLUTION     unique name of the unmanaged solution (default: ECA)

Safe to re-run: anything that already exists is skipped. Run it in Dev only.
"""
import argparse, json, os, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA = os.path.join(ROOT, 'docs/power-platform/schema/eca-schema.json')
LCID = 1033


def L(text):
    return {'@odata.type': 'Microsoft.Dynamics.CRM.Label',
            'LocalizedLabels': [{'@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', 'Label': text, 'LanguageCode': LCID}]}


def req_level(required):
    return {'Value': 'ApplicationRequired' if required else 'None'}


def attr_payload(c, option_sets):
    """Web API AttributeMetadata body for one non-lookup column (None for lookups)."""
    base = {'SchemaName': c['logicalName'], 'LogicalName': c['logicalName'], 'DisplayName': L(c['displayName']),
            'Description': L((c.get('notes') or '')[:500]), 'RequiredLevel': req_level(c['required'] and not c['primary'])}
    k = c['kind']
    T = 'Microsoft.Dynamics.CRM.'
    if k in ('string', 'autonumber'):
        fmt = {'Text': 'Text', 'Email': 'Email', 'Phone': 'Phone'}.get(c.get('format'), 'Text')
        d = {'@odata.type': T + 'StringAttributeMetadata', 'MaxLength': c.get('maxLength', 200), 'FormatName': {'Value': fmt}, **base}
        if k == 'autonumber':
            d['AutoNumberFormat'] = c['format']
            d['MaxLength'] = 100
        return d
    if k == 'memo':
        return {'@odata.type': T + 'MemoAttributeMetadata', 'MaxLength': min(c['maxLength'], 1048576), 'Format': 'TextArea', **base}
    if k == 'integer':
        return {'@odata.type': T + 'IntegerAttributeMetadata', 'Format': 'None',
                'MinValue': c['min'] if c.get('min') is not None else -2147483648,
                'MaxValue': c['max'] if c.get('max') is not None else 2147483647, **base}
    if k == 'decimal':
        return {'@odata.type': T + 'DecimalAttributeMetadata', 'Precision': c['precision'],
                'MinValue': c['min'] if c.get('min') is not None else -100000000000,
                'MaxValue': c['max'] if c.get('max') is not None else 100000000000, **base}
    if k == 'money':
        return {'@odata.type': T + 'MoneyAttributeMetadata', 'PrecisionSource': 2, **base}
    if k == 'boolean':
        d = c['default'] if isinstance(c.get('default'), bool) else False
        return {'@odata.type': T + 'BooleanAttributeMetadata', 'DefaultValue': d,
                'OptionSet': {'TrueOption': {'Value': 1, 'Label': L('Yes')}, 'FalseOption': {'Value': 0, 'Label': L('No')}}, **base}
    if k in ('date', 'datetime'):
        return {'@odata.type': T + 'DateTimeAttributeMetadata', 'Format': 'DateOnly' if k == 'date' else 'DateAndTime',
                'DateTimeBehavior': {'Value': 'DateOnly' if k == 'date' else 'UserLocal'}, **base}
    if k == 'choice':
        return {'@odata.type': T + 'PicklistAttributeMetadata',
                'GlobalOptionSet@odata.bind': "/GlobalOptionSetDefinitions(Name='%s')" % option_sets[c['choiceSet']], **base}
    if k == 'image':
        return {'@odata.type': T + 'ImageAttributeMetadata', 'CanStoreFullImage': False, **base}
    if k == 'file':
        return {'@odata.type': T + 'FileAttributeMetadata', 'MaxSizeInKB': 32768, **base}
    raise ValueError(k)


def option_set_payload(cs):
    return {'@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata', 'Name': cs['logicalName'], 'DisplayName': L(cs['name']),
            'OptionSetType': 'Picklist', 'IsGlobal': True,
            'Options': [{'Value': o['value'], 'Label': L(o['label'])} for o in cs['options']]}


def entity_payload(t, schema):
    prim = next(c for c in t['columns'] if c['primary'])
    prim_attr = attr_payload(prim, {})
    prim_attr['IsPrimaryName'] = True
    prim_attr['RequiredLevel'] = {'Value': 'SystemRequired'}
    return {'@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata', 'SchemaName': t['logicalName'],
            'DisplayName': L(t['displayName']), 'DisplayCollectionName': L(t['displayName'] + 's' if not t['displayName'].endswith('s') else t['displayName']),
            'Description': L((t.get('description') or '')[:500]), 'OwnershipType': 'UserOwned', 'HasActivities': False,
            'HasNotes': False, 'IsAuditEnabled': {'Value': True, 'CanBeChanged': True},
            'Attributes': [prim_attr]}


def relationship_payload(t, c, tables_by_name):
    """Lookup column -> 1:N relationship from the target table to this table."""
    target = 'systemuser' if c['target'] == 'systemuser' else tables_by_name[c['target']]['logicalName']
    name = 'eca_%s_%s_%s' % (t['logicalName'][4:], c['logicalName'][4:], target.replace('eca_', ''))
    # Parental cascade where the build pack says so (Visit Competitor -> Audit Visit).
    parental = 'Parental' in (c.get('behaviour') or '')
    cascade = {'Assign': 'NoCascade', 'Delete': 'Cascade' if parental else 'RemoveLink', 'Merge': 'NoCascade',
               'Reparent': 'NoCascade', 'Share': 'NoCascade', 'Unshare': 'NoCascade'}
    return {'@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata', 'SchemaName': name,
            'ReferencedEntity': target, 'ReferencingEntity': t['logicalName'],
            'CascadeConfiguration': cascade,
            'Lookup': {'@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata', 'SchemaName': c['logicalName'],
                       'DisplayName': L(c['displayName']), 'Description': L((c.get('notes') or '')[:500]),
                       'RequiredLevel': req_level(c['required'])}}


def plan(schema):
    """Ordered list of (kind, name, method, path, body). Pure: no network."""
    steps = []
    by_name = {t['displayName']: t for t in schema['tables']}
    opt = {c['name']: c['logicalName'] for c in schema['choices']}
    for cs in schema['choices']:
        steps.append(('choice', cs['logicalName'], 'POST', 'GlobalOptionSetDefinitions', option_set_payload(cs)))
    for t in schema['tables']:
        steps.append(('table', t['logicalName'], 'POST', 'EntityDefinitions', entity_payload(t, schema)))
    for t in schema['tables']:
        for c in t['columns']:
            if c['primary']:
                continue
            if c['kind'] == 'lookup':
                steps.append(('lookup', t['logicalName'] + '.' + c['logicalName'], 'POST', 'RelationshipDefinitions',
                              relationship_payload(t, c, by_name)))
            else:
                steps.append(('column', t['logicalName'] + '.' + c['logicalName'], 'POST',
                              "EntityDefinitions(LogicalName='%s')/Attributes" % t['logicalName'], attr_payload(c, opt)))
    for t in schema['tables']:
        if t.get('alternateKey'):
            steps.append(('key', t['logicalName'], 'POST', "EntityDefinitions(LogicalName='%s')/Keys" % t['logicalName'],
                          {'SchemaName': t['logicalName'] + '_key', 'DisplayName': L(t['displayName'] + ' key'),
                           'KeyAttributes': t['alternateKey']}))
    return steps


class Dv:
    def __init__(self, url, token, solution):
        self.base = url.rstrip('/') + '/api/data/v9.2/'
        self.h = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json; charset=utf-8',
                  'OData-MaxVersion': '4.0', 'OData-Version': '4.0', 'Accept': 'application/json', 'MSCRM.SolutionUniqueName': solution}

    def call(self, method, path, body=None):
        r = urllib.request.Request(self.base + path, method=method, headers=self.h,
                                   data=json.dumps(body).encode() if body is not None else None)
        try:
            with urllib.request.urlopen(r, timeout=120) as resp:
                return resp.status, resp.read().decode()
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()

    def exists(self, kind, name):
        t, _, col = name.partition('.')
        path = {'choice': "GlobalOptionSetDefinitions(Name='%s')?$select=Name" % name,
                'table': "EntityDefinitions(LogicalName='%s')?$select=LogicalName" % name,
                'column': "EntityDefinitions(LogicalName='%s')/Attributes(LogicalName='%s')?$select=LogicalName" % (t, col),
                'lookup': "EntityDefinitions(LogicalName='%s')/Attributes(LogicalName='%s')?$select=LogicalName" % (t, col),
                'key': "EntityDefinitions(LogicalName='%s')/Keys?$select=SchemaName&$filter=SchemaName eq '%s_key'" % (name, name)}[kind]
        code, text = self.call('GET', path)
        if kind == 'key':
            return code == 200 and json.loads(text).get('value')
        return code == 200


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='actually create things (default is a dry run)')
    ap.add_argument('--schema', default=SCHEMA)
    a = ap.parse_args()
    schema = json.load(open(a.schema, encoding='utf-8'))
    steps = plan(schema)
    counts = {}
    for s in steps:
        counts[s[0]] = counts.get(s[0], 0) + 1
    print('Plan:', ', '.join('%d %s' % (v, k) for k, v in counts.items()))
    if not a.apply:
        for kind, name, *_ in steps:
            print('  would create %-7s %s' % (kind, name))
        print('Dry run only. Re-run with --apply (and DATAVERSE_URL / DATAVERSE_TOKEN set) to create.')
        return 0
    url, token = os.environ.get('DATAVERSE_URL'), os.environ.get('DATAVERSE_TOKEN')
    if not url or not token:
        print('Set DATAVERSE_URL and DATAVERSE_TOKEN first (see the file header).', file=sys.stderr)
        return 2
    dv = Dv(url, token, os.environ.get('ECA_SOLUTION', schema['solution']))
    made = skipped = 0
    for kind, name, method, path, body in steps:
        if dv.exists(kind, name):
            skipped += 1
            continue
        code, text = dv.call(method, path, body)
        if code >= 300:
            print('FAILED %s %s: HTTP %s %s' % (kind, name, code, text[:400]), file=sys.stderr)
            return 1
        made += 1
        print('created %-7s %s' % (kind, name))
    print('Done: %d created, %d already existed.' % (made, skipped))
    return 0


if __name__ == '__main__':
    sys.exit(main())
