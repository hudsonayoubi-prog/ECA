"""Monthly state summaries and the national breakdown (BR-53): a Python port of `monthStats`, `execStats`,
`stateMonthly` and `nationalMonthly` in src/app.js.

Reference logic for the Power Automate report flows (F6/F7). Pure: records in, summary dict out. The numbers,
tables, highlight sentences and recipients are produced here; building the Excel file is a separate step.
tests/pp/test_monthly.py runs the prototype's own JavaScript on the same data and requires identical output.

Record shapes (camelCase like the prototype; see pp_scoring.py for visit/person/rules):
  state     {code, name}                     unis     {code, name, short, kind, state, status}
  location  {id, uni, campus, name, type, status 'Active'|'Inactive'|'Removed'}
  visit     as pp_scoring plus  dpLost, coolersOut, rbFacings, compFacings{brand:n}, compPos, compCoolers, issue, uni
  leads     {STATE: [names]}
  products  [(key, qsr, vending, competitor)]
`today` is an ISO date. A month before the current one is "closed"; the current month is month-to-date.
Known gap: localeCompare tie-breaks on accented names (tests use ASCII names).
"""
import math
from datetime import date, timedelta

import pp_scoring as S

PRODUCTS = [('ed', True, True, False), ('sf', True, True, False), ('zero', True, True, False), ('editions', True, True, False),
            ('monster', True, True, True), ('monsterUltra', True, False, True), ('v', True, True, True),
            ('vsf', True, False, True), ('vblue', True, False, True), ('solo', True, False, True)]


def _num(x):
    return S._or0(x)


def pct0(x):
    return '%d%%' % math.floor(x * 100 + 0.5)


def pct_or(x, d='—'):
    return d if x is None else pct0(x)


def plural(n, word, suffix='s'):
    return '%d %s%s' % (n, word, '' if n == 1 else suffix)


def iso(d):
    return d.isoformat()


def parse(s):
    return date.fromisoformat(str(s)[:10])


def shift_month(m, n):
    y, mo = int(m[:4]), int(m[5:7])
    t = y * 12 + (mo - 1) + n
    return '%04d-%02d' % (t // 12, t % 12 + 1)


def add_days(s, n):
    return iso(parse(s) + timedelta(days=n))


def approval_of(v):
    return S.approval_of(v)


def avg(xs):
    return sum(xs) / len(xs) if xs else None


def _is_num(x):
    return x is not None


def rb_range_pct(loc, rg, products=PRODUCTS):
    """Share of applicable Red Bull SKUs ranged, counting ANSWERED SKUs only (unlike the leaderboard)."""
    if rg is None:
        return None
    vend = bool(loc and loc.get('type') == 'Vending')
    prods = [k for k, qsr, vending, comp in products if not comp and (vending if vend else qsr)]
    ans = [k for k in prods if rg.get(k) in (0, 1, '0', '1')]
    return sum(1 for k in ans if _num(rg[k]) == 1) / len(ans) if ans else None


def exec_stats(visits, locs, start, end, products=PRODUCTS):
    ids = {l['id'] for l in locs}
    by_id = {l['id']: l for l in locs}
    vs = [v for v in visits if v.get('status') == 'Completed' and v['loc'] in ids and start <= v['date'] <= end
          and approval_of(v) not in ('Rejected', 'Duplicate')]
    latest_f, latest_r = {}, {}
    for v in vs:
        k = v['date'] + (v.get('time') or '')
        if v.get('rbFacings') is not None and (v['loc'] not in latest_f or k > latest_f[v['loc']][0]):
            latest_f[v['loc']] = (k, v)
        if v.get('ranging') is not None and (v['loc'] not in latest_r or k > latest_r[v['loc']][0]):
            latest_r[v['loc']] = (k, v)
    brands, present, rb, comp = {}, {}, 0.0, 0.0
    for _, v in latest_f.values():
        rb += _num(v.get('rbFacings'))
        brands['Red Bull'] = brands.get('Red Bull', 0) + _num(v.get('rbFacings'))
        for c, n in (v.get('compFacings') or {}).items():
            comp += _num(n)
            brands[c] = brands.get(c, 0) + _num(n)
            present[c] = present.get(c, 0) + 1
    audit_pcts = [p for p in (rb_range_pct(by_id.get(v['loc']), v['ranging'], products) for _, v in latest_r.values()) if p is not None]
    tot = lambda k: sum(_num(v.get(k)) for v in vs)
    return {'vs': vs, 'audits': len(vs), 'editions': tot('editions'), 'pos': tot('posPlaced'), 'coolers': tot('coolersIn'),
            'coolersOut': tot('coolersOut'), 'dpAdded': tot('dpAdded'), 'dpLost': tot('dpLost'), 'rbFacings': rb, 'compFacings': comp, 'share': rb / (rb + comp) if rb + comp else None,
            'shelfLocs': len(latest_f), 'brands': brands, 'present': present,
            'compPos': sum(_num(v.get('compPos')) for v in vs), 'compCoolers': sum(_num(v.get('compCoolers')) for v in vs),
            'rangingAudited': avg(audit_pcts)}


def derive_locs(locations, unis):
    """Locations plus institution fields, as the prototype's `D.locs`."""
    ub = {u['code']: u for u in unis}
    out = []
    for l in locations:
        u = ub.get(l['uni'])
        out.append({**l, 'locStatus': l['status'], 'uniName': (u or {}).get('name', l['uni']),
                    'state': (u or {}).get('state'), 'kind': (u or {}).get('kind')})
    return out


def month_stats(visits, locs, month, st, today, products=PRODUCTS):
    ls = [l for l in locs if l.get('state') and (not st or l['state'] == st)]
    ids = {l['id'] for l in ls}
    allv = [v for v in visits if v.get('status') == 'Completed' and str(v['date']).startswith(month) and v['loc'] in ids]
    vs = [v for v in allv if approval_of(v) not in ('Rejected', 'Duplicate')]
    active = [l for l in ls if l['locStatus'] == 'Active']
    seen = {v['loc'] for v in vs}
    visited = sum(1 for l in active if l['id'] in seen)
    total = lambda k: sum(_num(v.get(k)) for v in vs)
    m_end = today if month == today[:7] else add_days(shift_month(month, 1) + '-01', -1)
    ex = exec_stats(visits, ls, month + '-01', m_end, products)
    return {'ex': ex, 'share': ex['share'], 'rbFacings': ex['rbFacings'], 'compFacings': ex['compFacings'], 'shelfLocs': ex['shelfLocs'],
            'ranging': ex['rangingAudited'], 'compPos': ex['compPos'], 'compCoolers': ex['compCoolers'], 'vs': vs, 'locs': ls,
            'audits': len(vs), 'pending': sum(1 for v in vs if approval_of(v) == 'Pending'), 'excluded': len(allv) - len(vs),
            'active': len(active), 'visited': visited, 'coverage': visited / len(active) if active else 0,
            'dpAdded': total('dpAdded'), 'dpLost': total('dpLost'), 'net': total('dpAdded') - total('dpLost'),
            'editions': total('editions'), 'pos': total('posPlaced'), 'coolersIn': total('coolersIn'), 'coolersOut': total('coolersOut'),
            'issues': sum(1 for v in vs if v.get('issue')), 'auditors': len({v['staff'] for v in vs if v.get('staff')})}


def managers_for(people, st):
    return [p['name'] for p in people if p.get('role') == 'manager' and p.get('state') == st and p.get('status') == 'Active']


def leads_for(leads, people, st):
    return [n for n in leads.get(st, []) if any(p['name'] == n and p.get('status') == 'Active' for p in people)]


def admins(people):
    return [p['name'] for p in people if p.get('role') == 'admin' and p.get('status') == 'Active']


def _by(*keys):
    """Sort key helper: descending numeric keys then ascending name. Plain ordering, ASCII names."""
    return keys


def state_monthly(d, month, st):
    """d: {visits, people, locations, unis, states, leads, today, rules, products?}"""
    locs = derive_locs(d['locations'], d['unis'])
    live = [u for u in d['unis'] if u.get('status') != 'Removed']
    x = month_stats(d['visits'], locs, month, st, d['today'], d.get('products', PRODUCTS))
    insts = []
    for u in [u for u in live if u['state'] == st]:
        ls = [l for l in x['locs'] if l['uni'] == u['code']]
        act = [l for l in ls if l['locStatus'] == 'Active']
        lid = {l['id'] for l in ls}
        vs = [v for v in x['vs'] if v['loc'] in lid]
        seen = {v['loc'] for v in vs}
        vis = sum(1 for l in act if l['id'] in seen)
        insts.append({'u': u, 'active': len(act), 'visited': vis, 'coverage': vis / len(act) if act else 0, 'audits': len(vs),
                      'net': sum(_num(v.get('dpAdded')) - _num(v.get('dpLost')) for v in vs),
                      'editions': sum(_num(v.get('editions')) for v in vs), 'pos': sum(_num(v.get('posPlaced')) for v in vs)})
    insts.sort(key=lambda i: (-i['audits'], -i['active'], i['u']['name']))
    sms = []
    for p in d['people']:
        if p.get('role') == 'marketeer' and p.get('state') == st and (p.get('status') == 'Active' or any(v.get('staff') == p['name'] for v in x['vs'])):
            vs = [v for v in x['vs'] if v.get('staff') == p['name']]
            sms.append({'p': p, 'audits': len(vs), 'locations': len({v['loc'] for v in vs}),
                        'net': sum(_num(v.get('dpAdded')) - _num(v.get('dpLost')) for v in vs),
                        'editions': sum(_num(v.get('editions')) for v in vs), 'pos': sum(_num(v.get('posPlaced')) for v in vs),
                        'coolers': sum(_num(v.get('coolersIn')) for v in vs), 'last': max([v['date'] for v in vs], default=None)})
    sms.sort(key=lambda r: (-r['audits'], r['p']['name']))
    board = S.score_month(d['visits'], d['people'], d['locations'], d['rules'], month)
    top = [r for r in board['rows'] if r['state'] == st and r['rank']][:3]
    h = []
    if any(i['audits'] for i in insts):
        h.append('Most active: %s (%s)' % (insts[0]['u']['name'], plural(insts[0]['audits'], 'audit')))
    idle_i = [i for i in insts if i['active'] and not i['audits']]
    if idle_i:
        names = ', '.join((i['u'].get('short') or i['u']['name']) for i in idle_i[:4]) + ('…' if len(idle_i) > 4 else '')
        h.append('No audits at %s with active locations: %s' % (plural(len(idle_i), 'institution'), names))
    idle = sum(1 for r in sms if r['p'].get('status') == 'Active' and not r['audits'])
    if sms:
        h.append('%d of %d Student Marketeers completed audits%s' % (len(sms) - idle, len(sms), ' · %d with none' % idle if idle else ''))
    if x['share'] is not None:
        h.append('Share of shelf %s (Red Bull %s vs competitors %s facings at %s)' % (
            pct0(x['share']), _n(x['rbFacings']), _n(x['compFacings']), plural(x['shelfLocs'], 'location')))
    if x['ranging'] is not None:
        h.append('Red Bull ranging %s of SKUs at audited locations' % pct0(x['ranging']))
    if x['issues']:
        h.append('%s flagged at stores' % plural(x['issues'], 'issue'))
    if x['pending']:
        h.append('%s still awaiting approval' % plural(x['pending'], 'audit'))
    if not x['locs']:
        h.append('No audit locations set up in this state yet')
    to = list(dict.fromkeys(managers_for(d['people'], st) + leads_for(d['leads'], d['people'], st)))
    return {'kind': 'state', 'key': 'MS|%s|%s' % (st, month), 'month': month, 'st': st, 'x': x, 'insts': insts, 'sms': sms,
            'top': top, 'highlights': h, 'to': to}


def _n(v):
    return int(v) if float(v).is_integer() else v


def national_monthly(d, month):
    locs = derive_locs(d['locations'], d['unis'])
    live = [u for u in d['unis'] if u.get('status') != 'Removed']
    prod = d.get('products', PRODUCTS)
    x = month_stats(d['visits'], locs, month, None, d['today'], prod)
    states = []
    for st in d['states']:
        y = month_stats(d['visits'], locs, month, st['code'], d['today'], prod)
        sm = [p for p in d['people'] if p.get('role') == 'marketeer' and p.get('state') == st['code'] and p.get('status') == 'Active']
        states.append({'st': st, 'y': y, 'sms': len(sm), 'activeSms': sum(1 for p in sm if any(v.get('staff') == p['name'] for v in y['vs'])),
                       'insts': sum(1 for u in live if u['state'] == st['code']), 'managers': managers_for(d['people'], st['code'])})
    board = S.score_month(d['visits'], d['people'], d['locations'], d['rules'], month)
    top = [r for r in board['rows'] if r['rank']][:3]
    ranked = sorted([r for r in states if r['y']['active']], key=lambda r: -r['y']['coverage'])
    h = []
    by_aud = sorted(states, key=lambda r: -r['y']['audits'])
    if by_aud and by_aud[0]['y']['audits']:
        h.append('Most audits: %s (%d)' % (by_aud[0]['st']['code'], by_aud[0]['y']['audits']))
    if ranked:
        h.append('Best coverage: %s (%s of active locations visited)' % (ranked[0]['st']['code'], pct0(ranked[0]['y']['coverage'])))
    none = [r['st']['code'] for r in states if not r['y']['locs']]
    if none:
        h.append('No audit locations yet: %s' % ', '.join(none))
    quiet = [r['st']['code'] for r in states if r['y']['locs'] and not r['y']['audits']]
    if quiet:
        h.append('No audits this month: %s' % ', '.join(quiet))
    if x['share'] is not None:
        h.append('National share of shelf %s · Red Bull ranging %s · %s Editions, %s POS, %s coolers' % (
            pct0(x['share']), pct_or(x['ranging']), _n(x['editions']), _n(x['pos']), _n(x['coolersIn'])))
    withshare = sorted([r for r in states if r['y']['share'] is not None], key=lambda r: -r['y']['share'])
    if withshare:
        h.append('Best share of shelf: %s (%s)' % (withshare[0]['st']['code'], pct0(withshare[0]['y']['share'])))
    if x['pending']:
        h.append('%s awaiting approval nationally' % plural(x['pending'], 'audit'))
    return {'kind': 'national', 'key': 'MN|%s' % month, 'month': month, 'x': x, 'states': states, 'top': top, 'highlights': h, 'to': admins(d['people'])}


def summary_months(today):
    cur = today[:7]
    return [cur] + [shift_month(cur, -i) for i in range(1, 6)]


def report_row(summary, state_ids=None):
    """Monthly Report row (`eca_monthlyreport`, without the file). Summaries are due on the 1st of the next month 08:00."""
    kind = 'National breakdown' if summary['kind'] == 'national' else 'State summary'
    label = '%s · %s · %s' % (summary['month'], summary.get('st', 'All states'), kind)
    return {'eca_name': label, 'eca_month': summary['month'], 'eca_reporttype': kind,
            'eca_state': summary.get('st'), 'eca_generatedon': '%s-01T08:00:00' % shift_month(summary['month'], 1),
            'eca_recipients': ', '.join(summary['to'])}
