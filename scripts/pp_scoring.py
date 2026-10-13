"""Monthly leaderboard scoring: a line-for-line Python port of `scoreMonth` in src/app.js (BR-41 to BR-44).

This is the reference logic for the Power Automate score flow (F5) and for any Dataverse-side job. It is pure:
records in, scorecard out. tests/pp/test_scoring.py runs the prototype's own JavaScript on the same data and
checks the two agree.

Record shapes (plain dicts, camelCase like the prototype so the parity test can share fixtures):
  visit    {id, loc, staff, staffId, status, approval, imported, date 'YYYY-MM-DD', time, dpAdded, editions,
            posPlaced, coolersIn, ranging {productKey: 1|0|None}, approvedAt, submittedAt}
  person   {id, name, role, state, status, reportsTo}      (role 'marketeer' is scored)
  location {id, type 'QSR'|'Vending'}
  rules    {weights{ranging,tdp,editions,pos,coolers}, method 'relative'|'target', targets{tdp,editions,pos,coolers}, minAudits}
Known gap: the prototype's store-type / activity filters on the board are not ported (the score itself is unaffected).
"""
import functools, json, math, os

MEASURES = ['ranging', 'tdp', 'editions', 'pos', 'coolers']
# Red Bull products and which location types they apply to. Competitors are never scored.
# Keep in step with DEFAULT_REF.products in src/app.js (the parity test checks this).
PRODUCTS = [('ed', True, True), ('sf', True, True), ('zero', True, True), ('editions', True, True)]  # (key, qsr, vending)
VISIT_FIELD = {'tdp': 'dpAdded', 'editions': 'editions', 'pos': 'posPlaced', 'coolers': 'coolersIn'}


def _num(x):
    """JS unary plus on a value, with NaN for junk. None -> 0."""
    if x is None or x == '':
        return 0.0
    if isinstance(x, bool):
        return float(x)
    try:
        return float(x)
    except (TypeError, ValueError):
        return math.nan


def _or0(x):
    n = _num(x)
    return 0.0 if math.isnan(n) else n


def _round1(x):
    return math.floor(x * 10 + 0.5) / 10  # JS Math.round, not banker's rounding


def approval_of(v):
    return v.get('approval') or 'Approved'  # records from before approvals existed count as approved


def _cmp(a, b):
    return (a > b) - (a < b)


def score_month(visits, people, locations, rules, month, products=PRODUCTS):
    W, method, minA = rules['weights'], rules.get('method', 'relative'), rules['minAudits']
    loc_by = {l['id']: l for l in locations}

    acts = [v for v in visits if v.get('status') == 'Completed' and v.get('staff') and not v.get('imported')
            and str(v.get('date', '')).startswith(month)]
    counted = [v for v in acts if approval_of(v) == 'Approved']

    def by_person(p):
        return lambda v: (v.get('staffId') == p['id']) if v.get('staffId') else (v.get('staff') == p['name'])

    scorers = [p for p in people if p.get('role') == 'marketeer'
               and (p.get('status') == 'Active' or any(by_person(p)(v) for v in acts))]
    rows = []
    for p in scorers:
        mine = [v for v in acts if by_person(p)(v)]
        vs = [v for v in mine if approval_of(v) == 'Approved']
        latest = {}
        for v in vs:
            k = v['loc']
            key = v['date'] + (v.get('time') or '')
            if k not in latest or key > latest[k]['date'] + (latest[k].get('time') or ''):
                latest[k] = v
        pcts = []
        for v in latest.values():
            rg = v.get('ranging')
            if rg is None:  # {} is a real (empty) answer set, None is no answer set
                continue
            loc = loc_by.get(v['loc'])
            vend = bool(loc and loc.get('type') == 'Vending')
            prods = [k for k, qsr, vending in products if (vending if vend else qsr)]
            if prods:
                pcts.append(sum(1 for k in prods if _num(rg.get(k)) == 1) / len(prods) * 100)
        total_of = lambda k: sum(_or0(v.get(VISIT_FIELD[k])) for v in vs)
        last = sorted(v.get('approvedAt') or v.get('submittedAt') or v['date'] for v in vs)
        rows.append({'id': p['id'], 'name': p['name'], 'state': p.get('state'), 'reportsTo': p.get('reportsTo'),
                     'audits': len(vs), 'locations': len(latest),
                     'ranging': sum(pcts) / len(pcts) if pcts else 0,
                     'tdp': total_of('tdp'), 'editions': total_of('editions'), 'pos': total_of('pos'), 'coolers': total_of('coolers'),
                     'pending': sum(1 for v in mine if approval_of(v) == 'Pending'),
                     'excluded': sum(1 for v in mine if approval_of(v) in ('Rejected', 'Duplicate')),
                     'lastAt': last[-1] if last else None})

    q = [r for r in rows if r['audits'] >= minA]
    mx = {m: max([0] + [r[m] for r in q]) for m in MEASURES}

    def norm(k, val):
        if k == 'ranging':
            n = val
        elif method == 'target':
            t = _or0(rules['targets'].get(k))
            n = val / t * 100 if t > 0 else 0
        else:
            n = val / mx[k] * 100 if mx[k] > 0 else 0
        return min(100, n)

    wsum = sum(_or0(W.get(m)) for m in MEASURES) or 1
    for r in rows:
        r['qualified'] = r['audits'] >= minA
        r['scores'] = {m: norm(m, r[m]) for m in MEASURES}
        r['points'] = {m: r['scores'][m] * _or0(W.get(m)) / wsum for m in MEASURES}
        r['total'] = _round1(sum(r['points'][m] for m in MEASURES)) if r['qualified'] else 0

    def compare(a, b):
        for x, y in ((b['qualified'], a['qualified']), (b['total'], a['total']), (b['tdp'], a['tdp']),
                     (b['ranging'], a['ranging']), (b['audits'], a['audits'])):
            c = _cmp(int(x) if isinstance(x, bool) else x, int(y) if isinstance(y, bool) else y)
            if c:
                return c
        c = _cmp(str(a['lastAt']), str(b['lastAt']))  # earliest last approval first; None sorts as 'null' like JS
        return c or _cmp(a['name'], b['name'])
    rows.sort(key=functools.cmp_to_key(compare))
    k = 0
    for r in rows:
        if r['qualified']:
            k += 1
            r['rank'] = k
        else:
            r['rank'] = None
    pend = [v for v in acts if approval_of(v) == 'Pending']
    excl = [v for v in acts if approval_of(v) in ('Rejected', 'Duplicate')]
    upd = sorted(v.get('approvedAt') or v.get('submittedAt') for v in counted if v.get('approvedAt') or v.get('submittedAt'))
    return {'rows': rows, 'counted': counted, 'pending': pend, 'excluded': excl, 'lastUpdated': upd[-1] if upd else None}


def snapshot_rows(rows):
    """Rows for the Leaderboard Snapshot (Dataverse `eca_snapshotrow` columns). Rank blank = not ranked."""
    return [{'eca_user': r['id'], 'eca_rank': r['rank'], 'eca_totalscore': r['total'], 'eca_qualified': r['qualified'],
             'eca_audits': r['audits'], 'eca_rangingpct': r['ranging'], 'eca_tdp': r['tdp'], 'eca_editions': r['editions'],
             'eca_pos': r['pos'], 'eca_coolers': r['coolers'], 'eca_sranging': r['points']['ranging'],
             'eca_stdp': r['points']['tdp'], 'eca_seditions': r['points']['editions'], 'eca_spos': r['points']['pos'],
             'eca_scoolers': r['points']['coolers']} for r in rows]


def rules_from_dataverse(row):
    """eca_scoringruleset row (logical names) -> rules dict."""
    return {'weights': {'ranging': row['eca_wranging'], 'tdp': row['eca_wtdp'], 'editions': row['eca_weditions'],
                        'pos': row['eca_wpos'], 'coolers': row['eca_wcoolers']},
            'method': 'target' if row['eca_normalisation'] == 'Against targets' else 'relative',
            'targets': {'tdp': row.get('eca_ttdp'), 'editions': row.get('eca_teditions'), 'pos': row.get('eca_tpos'), 'coolers': row.get('eca_tcoolers')},
            'minAudits': row['eca_minaudits']}


def visit_from_dataverse(row, staff_id, staff_name, loc_id):
    """eca_auditvisit row (logical names, labels resolved) -> visit dict. Ranging comes from eca_rangingjson."""
    rg = row.get('eca_rangingjson')
    return {'id': row['eca_name'], 'loc': loc_id, 'staff': staff_name, 'staffId': staff_id, 'status': row['eca_visitstatus'],
            'approval': row.get('eca_approvalstatus'), 'imported': bool(row.get('eca_imported')),
            'date': row['eca_visitdate'], 'time': row.get('eca_visittime'),
            'dpAdded': row.get('eca_dpsadded'), 'editions': row.get('eca_editionssold'), 'posPlaced': row.get('eca_posplaced'),
            'coolersIn': row.get('eca_coolersin'), 'ranging': json.loads(rg) if rg else None,
            'approvedAt': row.get('eca_approvedon'), 'submittedAt': row.get('createdon')}
