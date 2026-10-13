import sys, re, datetime as dt, openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as L
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.formatting.rule import FormulaRule, CellIsRule
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.label import DataLabelList

src_path, out_path = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src_path)
TODAY = dt.datetime(2026, 10, 8)

NAVY = '1F3864'; GREEN = '375623'; RB_RED = 'C00000'
thin = Side(style='thin', color='BFBFBF'); B = Border(left=thin, right=thin, top=thin, bottom=thin)
BF = Font(name='Arial', size=10)
AUTO = PatternFill('solid', fgColor='EDEDED')
NOTE = Font(name='Arial', italic=True, size=9, color='666666')
SEL = PatternFill('solid', fgColor='FFF2CC')

def q(s): return f"'{s}'" if re.search(r"[^A-Za-z0-9_]", s) else s
def head(ws, r, c, t, fill=NAVY, size=10):
    x = ws.cell(r, c, t); x.font = Font(name='Arial', bold=True, color='FFFFFF', size=size)
    x.fill = PatternFill('solid', fgColor=fill); x.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True); x.border = B
    return x
def table(ws, name, ref, style='TableStyleMedium2'):
    t = Table(displayName=name, ref=ref); t.tableStyleInfo = TableStyleInfo(name=style, showRowStripes=True); ws.add_table(t)
def dv(ws, rngs, **kw):
    d = DataValidation(allow_blank=True, showErrorMessage=True, **kw); ws.add_data_validation(d)
    for r in rngs: d.add(r)
def status_cf(ws, rng, first_cell):
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{first_cell}="Overdue"'], fill=PatternFill('solid', fgColor='9C0006'), font=Font(color='FFFFFF', bold=True)))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{first_cell}="Due Soon"'], fill=PatternFill('solid', fgColor='FFC000')))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{first_cell}="No Visit Recorded"'], fill=PatternFill('solid', fgColor='FFF2CC'), font=Font(bold=True)))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{first_cell}="On Track"'], fill=PatternFill('solid', fgColor='C6EFCE')))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{first_cell}="Inactive"'], font=Font(color='808080', italic=True)))

# ======================================================== 1. read audit data (QSR + vending)
norm = lambda s: re.sub(r'[^a-z0-9#]', '', str(s).lower()) if s is not None else ''
ALIAS = {'campus': 'campus', 'bullringbullseye': 'bull', 'account': 'account', 'city': 'city', 'street': 'street', 'landmark': 'landmark',
         'postcode': 'postcode', 'pos': 'pos', 'cooler': 'cooler', 'channel': 'channel', 'classification': 'classification', 'indnka': 'indnka',
         'personincharge': 'pic', 'personic': 'pic', 'contact': 'contact', 'priceofcan': 'price', 'topcompetitor': 'topcomp',
         'competitorpricing': 'comppricing', 'lastvisit': 'lastvisit', 'nextstep': 'nextstep', 'ed': 'ed', 'zero': 'zero', 'sf': 'sf',
         'edition': 'edition', 'editions': 'edition', 'monster': 'monster', 'monsterultra': 'monsterultra', 'v': 'v', 'vsf': 'vsf',
         'vblue': 'vblue', 'soloenergy': 'soloenergy'}
def onp_map(ws):
    m = {}
    for c in range(1, ws.max_column + 1):
        for r in (1, 2):
            k = ALIAS.get(norm(ws.cell(r, c).value))
            if k and k not in m and not (r == 1 and k in ('ed', 'sf', 'v')): m[k] = c
    return m
def vend_map(ws):
    m = {}; prices = []; rng = []; sku = []
    for c in range(1, ws.max_column + 1):
        for r in (1, 2):
            n = norm(ws.cell(r, c).value)
            if n in ('campus', 'rmitcampus'): m['campus'] = c
            elif n in ('building', 'level', 'landmark', 'location'): m.setdefault(n, c)
            elif n == 'vendingcompany': m['company'] = c
            elif n == 'machineid': m['machine'] = c
            elif r == 2 and n in ('ed', 'sf'): m[n] = c
            elif r == 2 and n == 'editions': m['edition'] = c
            elif r == 2 and n == 'price': prices.append(c)
            elif r == 2 and n == 'ranging': rng.append(c)
            elif r == 2 and n == '#ofsku': sku.append(c)
    for k, v in zip(['price', 'vprice', 'mprice'], prices): m[k] = v
    for k, v in zip(['v', 'monster'], rng): m[k] = v
    for k, v in zip(['vsku', 'msku'], sku): m[k] = v
    return m
def data_rows(ws, keycols, skip):
    out = []
    for r in range(3, ws.max_row + 1):
        vals = [ws.cell(r, c).value for c in range(1, ws.max_column + 1)]
        if any(isinstance(x, str) and x.startswith('=COUNTIF') for x in vals): continue
        if norm(vals[0]) in ('sm', 'mts', 'both', 'sample') and all(v is None for v in vals[1:]): continue
        if r in skip: continue
        if any(ws.cell(r, c).value not in (None, '', ' ', '\xa0') for c in keycols): out.append(r)
    return out
def clean(v):
    if isinstance(v, str):
        v = re.sub(r'\s+', ' ', v.replace('‭', '').replace('‬', '')).strip()
        if v in ('', '-', '\xa0', 'NA', 'N/A'): return None
    return v
def parse_date(v):
    if isinstance(v, dt.datetime): return v
    if isinstance(v, str):
        try: return dt.datetime.strptime(v.strip(), '%d/%m/%Y')
        except ValueError: return None
    return None
def clean_campus(c):
    c = str(c or '').strip()
    return {'Monash Clayton': 'Clayton', 'Caulfield Monash': 'Caulfield', 'Caufield': 'Caulfield'}.get(c, c) or None

# tab, full, ID prefix, table stem, name stem, QSR audit tabs, vending tabs, in VIC master
UNIS = [
    ('Monash', 'Monash University', 'MON', 'Monash', 'Monash', [('Monash Clayton Audit', set()), ('Monash Caulfield Audit', set())], [], True),
    ('La Trobe', 'La Trobe University', 'LTU', 'LaTrobe', 'LaTrobe', [('La Trobe Audit', {3})], [('La Trobe Vending', {3})], True),
    ('Deakin', 'Deakin University', 'DEA', 'Deakin', 'Deakin', [('Deakin Audit', {3})], [('Deakin Vending', {3})], True),
    ('Victoria University', 'Victoria University', 'VU', 'Victoria', 'Victoria', [('Victoria Uni Audit', set())], [('Victoria Uni Vending', set())], True),
    ('RMIT', 'RMIT University', 'RMIT', 'RMIT', 'RMIT', [('RMIT Audit', set())], [('RMIT Vending', {3})], True),
    ('Swinburne', 'Swinburne University', 'SWI', 'Swinburne', 'Swinburne', [('Swinburne Audit', set())], [('Swinburne Vending', {3})], True),
    ('Melbourne University', 'University of Melbourne', 'UOM', 'Melbourne', 'Melbourne', [('Melbourne Uni Audit', set())], [('Melbourne Uni Vending', set())], True),
    ('UTAS', 'University of Tasmania', 'UTAS', 'UTAS', 'UTAS', [], [], False),
]
locs = {}
for tab, full, pre, _, _, qtabs, vtabs, _ in UNIS:
    rows = []
    for t, skip in qtabs:
        ws = wb[t]; m = onp_map(ws)
        for r in data_rows(ws, [m['account']], skip):
            g = lambda k: clean(ws.cell(r, m[k]).value) if k in m else None
            street, city = g('street'), g('city')
            addr = street if (not city or (street and str(city).lower() in str(street).lower())) else ', '.join(str(x) for x in (street, city) if x)
            d = dict(type='QSR', name=str(g('account') or '').strip(), campus=clean_campus(g('campus')), addr=addr, landmark=g('landmark'),
                     postcode=g('postcode'), last=parse_date(ws.cell(r, m['lastvisit']).value) if 'lastvisit' in m else None,
                     notes=g('nextstep'))
            for k in ('ed', 'zero', 'sf', 'edition', 'monster', 'monsterultra', 'v', 'vsf', 'vblue', 'soloenergy', 'pos', 'cooler', 'price',
                      'topcomp', 'comppricing', 'bull', 'channel', 'classification', 'indnka', 'pic', 'contact'):
                d[k] = g(k)
            rows.append(d)
    n_q = len(rows)
    for t, skip in vtabs:
        ws = wb[t]; m = vend_map(ws)
        for r in data_rows(ws, [m[k] for k in ('machine', 'building', 'company') if k in m], skip):
            g = lambda k: clean(ws.cell(r, m[k]).value) if k in m else None
            where = g('location') or g('landmark')
            bld, lvl = g('building'), g('level')
            bld = (f'Bldg {bld}' if re.match(r'^\d', str(bld)) else str(bld)) if bld is not None else None
            lvl = (f'L{lvl}' if re.match(r'^(\d+|[A-Z])$', str(lvl)) else str(lvl)) if lvl is not None else None
            bits = [bld, lvl, where]
            name = 'Vending · ' + ' '.join(str(b) for b in bits if b)
            if g('machine'): name += f" ({g('machine')})"
            d = dict(type='Vending', name=name, campus=clean_campus(g('campus')), addr=None, landmark=where, building=g('building'),
                     level=g('level'), last=None, notes=None, company=g('company'), machine=g('machine'))
            for k in ('ed', 'sf', 'edition', 'price', 'v', 'monster', 'vsku', 'vprice', 'msku', 'mprice'): d[k] = g(k)
            rows.append(d)
    seen = {}
    for d in rows:
        k = d['name'].lower(); seen[k] = seen.get(k, 0) + 1
        if seen[k] > 1: d['name'] = f"{d['name']} ({seen[k]})"
    qi = vi = 0
    for d in rows:
        if d['type'] == 'QSR': qi += 1; d['id'] = f'{pre}-{qi:03d}'
        else: vi += 1; d['id'] = f'{pre}-VM-{vi:03d}'
    locs[tab] = rows

# ======================================================== 2. drop old tabs
keep = {'Index', 'Staff Management', 'Calendar'}
for n in list(wb.sheetnames):
    if n not in keep: del wb[n]
for n in list(wb.defined_names.keys()): del wb.defined_names[n]
S = wb['Staff Management']
send = max(r for r in range(2, S.max_row + 1) if S.cell(r, 8).value is not None or S.cell(r, 1).value is not None)
send = 81
SM = "'Staff Management'"

# ======================================================== 3. university tabs
LCOLS = [  # key, header, width, kind (in=input, auto=formula)
    ('id', 'Location ID', 13, 'in'), ('type', 'Type', 9, 'in'), ('name', 'Store/Location', 32, 'in'), ('campus', 'Campus', 12, 'in'),
    ('addr', 'Address', 26, 'in'), ('landmark', 'Landmark / Spot', 24, 'in'), ('building', 'Building', 9, 'in'), ('level', 'Level', 7, 'in'),
    ('postcode', 'Postcode', 9, 'in'), ('status', 'Status', 9, 'in'), ('added', 'Date Added', 11, 'in'), ('cycle', 'Visit Cycle (days)', 9, 'in'),
    ('lastv', 'Last Visit Date', 12, 'auto'), ('due', 'Next Visit Due', 12, 'auto'), ('days', 'Days Until Due', 9, 'auto'), ('vstat', 'Visit Status', 17, 'auto'),
    ('ed', 'ED', 6, 'in'), ('zero', 'Zero', 6, 'in'), ('sf', 'SF', 6, 'in'), ('edition', 'Editions', 8, 'in'), ('monster', 'Monster', 8, 'in'),
    ('monsterultra', 'Monster Ultra', 8, 'in'), ('v', 'V', 6, 'in'), ('vsf', 'V SF', 6, 'in'), ('vblue', 'V Blue', 6, 'in'), ('soloenergy', 'Solo Energy', 7, 'in'),
    ('pos', 'POS', 6, 'in'), ('cooler', 'Cooler', 7, 'in'), ('price', 'Red Bull Price ($)', 9, 'in'), ('topcomp', 'Top Competitor', 13, 'in'),
    ('comppricing', 'Competitor Price ($)', 10, 'in'), ('bull', "Bullring / Bull's Eye", 9, 'in'), ('channel', 'Channel', 8, 'in'),
    ('classification', 'Classification', 9, 'in'), ('indnka', 'IND / NKA', 9, 'in'), ('pic', 'Person-in-charge', 14, 'in'), ('contact', 'Contact', 14, 'in'),
    ('company', 'Vending Company', 14, 'in'), ('machine', 'Machine ID', 12, 'in'), ('vsku', 'V # of SKU', 7, 'in'), ('vprice', 'V Price ($)', 8, 'in'),
    ('msku', 'Monster # of SKU', 8, 'in'), ('mprice', 'Monster Price ($)', 8, 'in'), ('notes', 'Notes / Next Step', 40, 'in'),
    ('cv', 'Completed Visits', 9, 'auto'), ('dpa', 'DPs Added', 8, 'auto'), ('dpl', 'DPs Lost', 8, 'auto'), ('dpn', 'Net DPs', 8, 'auto'),
    ('eds', 'Editions Sold In', 9, 'auto'), ('posp', 'POS Placed', 8, 'auto'), ('ci', 'Coolers Installed', 9, 'auto'), ('co', 'Coolers Removed', 9, 'auto'),
]
LC = {k: L(i) for i, (k, *_r) in enumerate(LCOLS, 1)}
LAST_LCOL = L(len(LCOLS))
GROUPS = [('LOCATION', 'id', 'cycle', NAVY), ('14-DAY REMINDER (auto)', 'lastv', 'vstat', GREEN), ('RANGING + PRICING', 'ed', 'comppricing', '2F5597'),
          ('QSR DETAILS', 'bull', 'contact', '7F6000'), ('VENDING DETAILS', 'company', 'mprice', '7030A0'), ('', 'notes', 'notes', NAVY),
          ('PROGRESS FROM VISITS (auto)', 'cv', 'co', GREEN)]
VCOLS = [('vid', 'Visit ID', 11, 'auto'), ('loc', 'Location ID', 12, 'auto'), ('vtype', 'Type', 9, 'auto'), ('store', 'Store/Location', 32, 'in'),
         ('date', 'Visit Date', 12, 'in'), ('staff', 'Staff Member', 16, 'in'), ('vst', 'Visit Status', 12, 'in'), ('vnotes', 'Notes', 30, 'in'),
         ('a', 'DPs Added', 8, 'in'), ('l', 'DPs Lost', 8, 'in'), ('n', 'Net DPs', 8, 'auto'), ('e', 'Editions Sold In', 9, 'in'),
         ('ef', 'Editions Flavours', 16, 'in'), ('p', 'POS Placed', 8, 'in'), ('pt', 'POS Type', 12, 'in'), ('ci', 'Coolers Installed', 9, 'in'),
         ('co', 'Coolers Removed', 9, 'in'), ('ns', 'Next Step', 34, 'in')]
VC = {k: L(i) for i, (k, *_r) in enumerate(VCOLS, 1)}
VIEW = [('id', 'Location ID', None), ('type', 'Type', None), ('name', 'Store/Location', None), ('campus', 'Campus', None), ('landmark', 'Landmark / Spot', None),
        ('status', 'Status', None), ('vstat', 'Visit Status', None), ('lastv', 'Last Visit', 'dd/mm/yyyy'), ('due', 'Next Due', 'dd/mm/yyyy'),
        ('days', 'Days Until Due', None), ('ed', 'ED', None), ('sf', 'SF', None), ('zero', 'Zero', None), ('edition', 'Editions', None),
        ('monster', 'Monster', None), ('v', 'V', None), ('pos', 'POS', None), ('cooler', 'Cooler', None), ('price', 'RB Price', '$0.00'),
        ('topcomp', 'Top Competitor', None), ('cv', 'Visits', None), ('dpn', 'Net DPs', '+0;-0;0'), ('notes', 'Notes / Next Step', None)]
# hidden helper columns
H_VIEW, H_RANK, H_MKEY, H_MONTH, H_LIST, H_STAFF, H_VPOS = 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI'
VROWS = 500; SPARE = 40
info = {}
for tab, full, pre, tstem, nstem, _, _, in_master in UNIS:
    ws = wb.create_sheet(tab); ws.sheet_properties.tabColor = NAVY
    rows = locs[tab]; n = len(rows); N = n + SPARE
    nq = sum(1 for d in rows if d['type'] == 'QSR'); nv = n - nq
    VW0 = 9; vw_first = VW0 + 1; vw_last = VW0 + N
    L0 = vw_last + 4; lf = L0 + 1; ll = L0 + N
    V0 = ll + 4; vf = V0 + 1; vl = V0 + VROWS
    info[tab] = dict(full=full, pre=pre, lf=lf, ll=ll, vf=vf, vl=vl, L0=L0, V0=V0, n=n, nq=nq, nv=nv, in_master=in_master)
    lR = lambda k: f'${LC[k]}${lf}:${LC[k]}${ll}'
    vR = lambda k: f'${VC[k]}${vf}:${VC[k]}${vl}'
    hR = lambda c: f'${c}${lf}:${c}${ll}'

    ws['A1'] = full; ws['A1'].font = Font(name='Arial', bold=True, size=16)
    ws['A2'] = 'Pick QSR, Vending or All in the yellow Show box to change the view. Edit locations in the Locations table and log visits in the Visits table further down.'
    ws['A3'] = 'Only Completed visits count and reset the visit clock. Grey and green columns calculate themselves.'
    ws['A2'].font = NOTE; ws['A3'].font = NOTE
    ws['A5'] = 'Show'; ws['A5'].font = Font(name='Arial', bold=True, size=12); ws['A5'].alignment = Alignment(horizontal='right')
    ws['B5'] = 'QSR'; ws['B5'].fill = SEL; ws['B5'].font = Font(name='Arial', bold=True, size=12, color='0000FF'); ws['B5'].border = B
    ws['B5'].alignment = Alignment(horizontal='center')
    dv(ws, ['B5'], type='list', formula1='"QSR,Vending,All"')
    ws['C5'] = f'="Showing "&COUNT({hR(H_VIEW)})&" of "&COUNTIF({lR("id")},"?*")&" locations"'; ws['C5'].font = Font(name='Arial', italic=True, size=10)
    ws['F5'] = 'QSR'; ws['G5'] = f'=COUNTIFS({lR("type")},"QSR",{lR("id")},"?*")'
    ws['H5'] = 'Vending'; ws['I5'] = f'=COUNTIFS({lR("type")},"Vending",{lR("id")},"?*")'
    ws['J5'] = 'Overdue'; ws['K5'] = f'=COUNTIFS({lR("vstat")},"Overdue",{lR("type")},IF($B$5="All","*",$B$5))'
    for c in 'FHJ': ws[f'{c}5'].font = Font(name='Arial', size=9, color='595959'); ws[f'{c}5'].alignment = Alignment(horizontal='right')
    for c in 'GIK': ws[f'{c}5'].font = Font(name='Arial', bold=True, size=11)
    ws['K5'].font = Font(name='Arial', bold=True, size=11, color=RB_RED)
    ws['M5'] = '→ Edit locations'; ws['M5'].hyperlink = f'#{q(tab)}!A{L0}'
    ws['P5'] = '→ Log visits'; ws['P5'].hyperlink = f'#{q(tab)}!A{V0}'
    for c in 'MP': ws[f'{c}5'].font = Font(name='Arial', color='0563C1', underline='single', bold=True)

    # ---------------- view
    ws.cell(VW0 - 1, 1, '="LOCATION VIEW: "&IF($B$5="All","QSR + VENDING",UPPER($B$5))&"  (read-only, updates with the Show box)"').font = Font(name='Arial', bold=True, size=11, color=NAVY)
    for i, (k, h, fmt) in enumerate(VIEW, 1): head(ws, VW0, i, h)
    ws.row_dimensions[VW0].height = 30
    for j in range(N):
        r = vw_first + j
        ws[f'{H_VPOS}{r}'] = f'=IFERROR(MATCH({j + 1},{hR(H_VIEW)},0),"")'
        for i, (k, h, fmt) in enumerate(VIEW, 1):
            src = f'INDEX({lR(k)},${H_VPOS}{r})'
            x = ws.cell(r, i, f'=IF(${H_VPOS}{r}="","",IF({src}="","",{src}))')
            x.font = BF; x.border = Border(bottom=Side(style='hair', color='D9D9D9'))
            if fmt: x.number_format = fmt
            if i >= 6 and k not in ('topcomp', 'notes', 'landmark'): x.alignment = Alignment(horizontal='center')
    status_cf(ws, f'G{vw_first}:G{vw_last}', f'$G{vw_first}')
    ws.conditional_formatting.add(f'J{vw_first}:J{vw_last}', FormulaRule(formula=[f'AND(ISNUMBER($J{vw_first}),$J{vw_first}<0)'], font=Font(color=RB_RED, bold=True)))

    # ---------------- locations table
    ws.cell(L0 - 2, 1, 'LOCATIONS  (QSR + vending in one list, edit here)').font = Font(name='Arial', bold=True, size=11, color=NAVY)
    ws.cell(L0 - 2, 6, 'Add new locations in the blank rows: pick a Type, give a new ID (QSR: ' + pre + '-0xx, vending: ' + pre + '-VM-0xx), set Status Active. Never delete a row; set it Inactive.').font = NOTE
    for g, a, b, col in GROUPS:
        ca, cb = openpyxl.utils.column_index_from_string(LC[a]), openpyxl.utils.column_index_from_string(LC[b])
        if g:
            if cb > ca: ws.merge_cells(start_row=L0 - 1, start_column=ca, end_row=L0 - 1, end_column=cb)
            head(ws, L0 - 1, ca, g, col, 9)
    for i, (k, h, w, kind) in enumerate(LCOLS, 1): ws.cell(L0, i, h)
    ws.row_dimensions[L0].height = 42
    for j in range(N):
        r = lf + j; A = f'$A{r}'
        if j < n:
            d = rows[j]
            vals = dict(d); vals.update(status='Active', added=TODAY, cycle=14)
            for k, h, w, kind in LCOLS:
                if kind == 'in' and vals.get(k) is not None: ws[f'{LC[k]}{r}'] = vals[k]
        c = lambda k: f'{LC[k]}{r}'
        ws[c('lastv')] = f'=IF({A}="","",IF(COUNTIFS({vR("loc")},{A},{vR("vst")},"Completed")=0,"",_xlfn.MAXIFS({vR("date")},{vR("loc")},{A},{vR("vst")},"Completed")))'
        ws[c('due')] = f'=IF({A}="","",IF({c("lastv")}="",IF({c("added")}="","",{c("added")}+N({c("cycle")})),{c("lastv")}+N({c("cycle")})))'
        ws[c('days')] = f'=IF(OR({A}="",{c("due")}=""),"",{c("due")}-TODAY())'
        ws[c('vstat')] = (f'=IF({A}="","",IF({c("status")}="Inactive","Inactive",IF({c("lastv")}="","No Visit Recorded",'
                          f'IF({c("due")}<TODAY(),"Overdue",IF({c("due")}<=TODAY()+3,"Due Soon","On Track")))))')
        ws[c('cv')] = f'=IF({A}="","",COUNTIFS({vR("loc")},{A},{vR("vst")},"Completed"))'
        for k, vk in [('dpa', 'a'), ('dpl', 'l'), ('eds', 'e'), ('posp', 'p'), ('ci', 'ci'), ('co', 'co')]:
            ws[c(k)] = f'=IF({A}="","",SUMIFS({vR(vk)},{vR("loc")},{A},{vR("vst")},"Completed"))'
        ws[c('dpn')] = f'=IF({A}="","",{c("dpa")}-{c("dpl")})'
        # helpers
        ws[f'{H_VIEW}{r}'] = (f'=IF({A}="","",IF($B$5="All",COUNTIFS($A${lf}:{A},"?*"),'
                              f'IF({c("type")}=$B$5,COUNTIFS($A${lf}:{A},"?*",${LC["type"]}${lf}:{c("type")},$B$5),"")))')
        ws[f'{H_RANK}{r}'] = (f'=IF(AND({c("status")}="Active",{c("name")}<>"",OR($B$5="All",{c("type")}=$B$5)),'
                              f'COUNTIFS({lR("status")},"Active",{lR("name")},"<"&{c("name")},{lR("type")},IF($B$5="All","*",$B$5))+1,"")')
        if in_master:
            ws[f'{H_MKEY}{r}'] = (f"=IF({A}=\"\",\"\",IF(OR('VIC Master'!$C$4=\"All\",'VIC Master'!$C$4=\"{full}\"),"
                                  f"IF('VIC Master'!$C$5=\"All\",COUNTIFS($A${lf}:{A},\"?*\"),IF({c('type')}='VIC Master'!$C$5,"
                                  f"COUNTIFS($A${lf}:{A},\"?*\",${LC['type']}${lf}:{c('type')},'VIC Master'!$C$5),\"\")),\"\"))")
        for i, (k, h, w, kind) in enumerate(LCOLS, 1):
            x = ws.cell(r, i); x.font = BF; x.border = B
            if kind == 'auto': x.fill = AUTO if k in ('lastv', 'due', 'days', 'vstat') else PatternFill('solid', fgColor='E2EFDA')
            if i >= 7 and k not in ('notes', 'topcomp', 'pic', 'contact', 'company', 'machine'): x.alignment = Alignment(horizontal='center')
        for k in ('added', 'lastv', 'due'): ws[c(k)].number_format = 'dd/mm/yyyy'
        for k in ('price', 'comppricing', 'vprice', 'mprice'): ws[c(k)].number_format = '$0.00'
        ws[c('dpn')].number_format = '+0;-0;0'
    table(ws, f'tbl{tstem}Locations', f'A{L0}:{LAST_LCOL}{ll}')
    status_cf(ws, f'{LC["vstat"]}{lf}:{LC["vstat"]}{ll}', f'${LC["vstat"]}{lf}')

    # ---------------- visits table
    ws.cell(V0 - 2, 1, 'VISITS  (one row per visit, log here)').font = Font(name='Arial', bold=True, size=11, color=NAVY)
    ws.cell(V0 - 2, 6, 'The Store/Location dropdown follows the Show box: set it to All to pick from both QSR and vending.').font = NOTE
    for i, (k, h, w, kind) in enumerate(VCOLS, 1): ws.cell(V0, i, h)
    ws.row_dimensions[V0].height = 30
    seeds = sorted([d for d in rows if d.get('last')], key=lambda d: d['last'])
    for j in range(VROWS):
        r = vf + j; c = lambda k: f'{VC[k]}{r}'
        if j < len(seeds):
            d = seeds[j]
            ws[c('store')] = d['name']; ws[c('date')] = d['last']; ws[c('vst')] = 'Completed'
            ws[c('vnotes')] = 'Imported: last visit recorded on the audit tab'
            if d.get('notes'): ws[c('ns')] = d['notes']
        ws[c('vid')] = f'=IF({c("store")}="","","{pre}-V"&TEXT(ROW()-{V0},"0000"))'
        ws[c('loc')] = f'=IF({c("store")}="","",IFERROR(INDEX({lR("id")},MATCH({c("store")},{lR("name")},0)),"Not found"))'
        ws[c('vtype')] = f'=IF(OR({c("loc")}="",{c("loc")}="Not found"),"",INDEX({lR("type")},MATCH({c("loc")},{lR("id")},0)))'
        ws[c('n')] = f'=IF(AND({c("a")}="",{c("l")}=""),"",N({c("a")})-N({c("l")}))'
        ws[f'{H_MONTH}{r}'] = (f'=IF(OR({c("loc")}="",{c("date")}="",{c("vst")}<>"Completed"),"",IF(COUNTIFS(${VC["loc"]}${vf}:{c("loc")},{c("loc")},'
                               f'${VC["vst"]}${vf}:{c("vst")},"Completed",${VC["date"]}${vf}:{c("date")},">="&(EOMONTH({c("date")},-1)+1),'
                               f'${VC["date"]}${vf}:{c("date")},"<="&EOMONTH({c("date")},0))=1,1,0))')
        for i, (k, h, w, kind) in enumerate(VCOLS, 1):
            x = ws.cell(r, i); x.font = BF; x.border = B
            if kind == 'auto': x.fill = AUTO
        ws[c('date')].number_format = 'dd/mm/yyyy'; ws[c('n')].number_format = '+0;-0;0'
    table(ws, f'tbl{tstem}Visits', f'A{V0}:{L(len(VCOLS))}{vl}')
    ws.conditional_formatting.add(f'{VC["n"]}{vf}:{VC["n"]}{vl}', CellIsRule(operator='lessThan', formula=['0'], font=Font(color=RB_RED, bold=True)))
    ws.conditional_formatting.add(f'{LC["dpn"]}{lf}:{LC["dpn"]}{ll}', CellIsRule(operator='lessThan', formula=['0'], font=Font(color=RB_RED, bold=True)))

    # ---------------- dropdown helper lists + named ranges
    for k in range(1, N + 1):
        ws[f'{H_LIST}{k + 1}'] = f'=IFERROR(INDEX({lR("name")},MATCH({k},{hR(H_RANK)},0)),"")'
    for k in range(1, 41):
        ws[f'{H_STAFF}{k + 1}'] = f'=IFERROR(INDEX({SM}!$A$2:$A${send},MATCH("{full}|{k}",{SM}!$H$2:$H${send},0)),"")'
    for col, t in [(H_VIEW, 'view #'), (H_RANK, 'list rank'), (H_MKEY, 'master #'), (H_MONTH, 'first visit of month'), (H_LIST, 'location list'),
                   (H_STAFF, 'staff list'), (H_VPOS, 'view row')]:
        ws[f'{col}1'] = f'Helper: {t}'; ws.column_dimensions[col].hidden = True
    wb.defined_names[f'{nstem}StaffList'] = DefinedName(f'{nstem}StaffList', attr_text=f'OFFSET({q(tab)}!${H_STAFF}$2,0,0,MAX(1,COUNTIF({q(tab)}!${H_STAFF}$2:${H_STAFF}$41,"?*")),1)')
    wb.defined_names[f'{nstem}LocationList'] = DefinedName(f'{nstem}LocationList', attr_text=f'OFFSET({q(tab)}!${H_LIST}$2,0,0,MAX(1,COUNTIF({q(tab)}!${H_LIST}$2:${H_LIST}${N + 1},"?*")),1)')

    # ---------------- validations
    lr_ = lambda k: f'{LC[k]}{lf}:{LC[k]}{ll}'; vr_ = lambda k: f'{VC[k]}{vf}:{VC[k]}{vl}'
    dv(ws, [lr_('type')], type='list', formula1='"QSR,Vending"')
    dv(ws, [lr_('status')], type='list', formula1='"Active,Inactive"')
    dv(ws, [lr_('added'), vr_('date')], type='date', operator='greaterThan', formula1='DATE(2020,1,1)', error='Enter a date, e.g. 08/10/2026')
    dv(ws, [lr_('cycle')], type='whole', operator='between', formula1='1', formula2='365', error='Days between visits, e.g. 14')
    dv(ws, [lr_(k) for k in ('ed', 'zero', 'sf', 'edition', 'monster', 'monsterultra', 'v', 'vsf', 'vblue', 'soloenergy', 'pos', 'cooler')],
       type='list', formula1='"1,0"', error='1 = yes, 0 = no')
    dv(ws, [lr_('bull')], type='list', formula1='"EYE,RING"')
    dv(ws, [lr_('channel')], type='list', formula1='"OnP,OffP"')
    dv(ws, [lr_('classification')], type='list', formula1='"A,B,C,D"')
    dv(ws, [lr_('indnka')], type='list', formula1='"IND,NKA,Vending"')
    dv(ws, [vr_('store')], type='list', formula1=f'={nstem}LocationList', error='Pick an active location (the list follows the Show box at the top).')
    dv(ws, [vr_('staff')], type='list', formula1=f'={nstem}StaffList', error='Pick a staff member allocated to this university (see Staff Management).')
    dv(ws, [vr_('vst')], type='list', formula1='"Scheduled,Completed,Cancelled"')
    dv(ws, [vr_('pt')], type='list', formula1='"Price tag,Wobbler,Poster,Shelf strip,Fridge decal,Counter unit,Menu board,Vending decal,Other"')
    dv(ws, [vr_(k) for k in ('a', 'l', 'e', 'p', 'ci', 'co')], type='whole', operator='between', formula1='0', formula2='200', error='Enter a whole number (0 or more).')

    # ---------------- widths (max of the three sections sharing each column)
    for i in range(1, len(LCOLS) + 1):
        w = LCOLS[i - 1][2]
        if i <= len(VCOLS): w = max(w, VCOLS[i - 1][2])
        if i <= len(VIEW): w = max(w, {1: 13, 2: 9, 3: 32, 4: 12, 5: 24, 6: 9, 7: 17, 8: 11, 9: 11, 10: 9}.get(i, 7))
        ws.column_dimensions[L(i)].width = min(w, 34)
    ws.column_dimensions['W'].width = 40
    ws.freeze_panes = 'D1'

# ======================================================== 4. VIC Master (dynamic, both types)
VIC = [u for u in UNIS if u[7]]
M = wb.create_sheet('VIC Master'); M.sheet_properties.tabColor = NAVY
M['A1'] = 'VIC Master: every location across VIC universities'; M['A1'].font = Font(name='Arial', bold=True, size=16)
M['A2'] = 'Live from each university tab. Use the yellow boxes to filter; edit locations on the university tabs, not here.'; M['A2'].font = NOTE
M['B4'] = 'University'; M['B5'] = 'Type'
for c in ('B4', 'B5'): M[c].font = Font(name='Arial', bold=True); M[c].alignment = Alignment(horizontal='right')
M['C4'] = 'All'; M['C5'] = 'All'
for c in ('C4', 'C5'): M[c].fill = SEL; M[c].font = Font(name='Arial', bold=True, color='0000FF'); M[c].border = B
dv(M, ['C4'], type='list', formula1='"All,' + ','.join(u[1] for u in VIC) + '"')
dv(M, ['C5'], type='list', formula1='"All,QSR,Vending"')
TC = 'IF($C$5="All","*",$C$5)'
# summary by university (type filter applies)
SH = 7
M.cell(SH - 1, 2, '="Summary by university: "&IF($C$5="All","QSR + Vending",$C$5)').font = Font(name='Arial', bold=True, size=11, color=NAVY)
scols = ['University', 'Locations', 'Active', 'On Track', 'Overdue', 'No Visit Recorded', 'ED', 'SF', 'Editions', 'Monster', 'V', 'POS', 'Cooler', 'Avg RB Price']
for i, h in enumerate(scols, 2): head(M, SH, i, h)
M.row_dimensions[SH].height = 30
for j, u in enumerate(VIC):
    r = SH + 1 + j; ii = info[u[0]]; t = q(u[0])
    R = lambda k: f'{t}!${LC[k]}${ii["lf"]}:${LC[k]}${ii["ll"]}'
    M.cell(r, 2, u[1])
    M.cell(r, 3, f'=COUNTIFS({R("id")},"?*",{R("type")},{TC})')
    M.cell(r, 4, f'=COUNTIFS({R("status")},"Active",{R("type")},{TC})')
    M.cell(r, 5, f'=COUNTIFS({R("vstat")},"On Track",{R("type")},{TC})+COUNTIFS({R("vstat")},"Due Soon",{R("type")},{TC})')
    M.cell(r, 6, f'=COUNTIFS({R("vstat")},"Overdue",{R("type")},{TC})')
    M.cell(r, 7, f'=COUNTIFS({R("vstat")},"No Visit Recorded",{R("type")},{TC})')
    for i, k in enumerate(['ed', 'sf', 'edition', 'monster', 'v', 'pos', 'cooler'], 8):
        M.cell(r, i, f'=IF($C{r}=0,"-",COUNTIFS({R(k)},1,{R("type")},{TC})/$C{r})').number_format = '0%'
    M.cell(r, 15, f'=IFERROR(AVERAGEIFS({R("price")},{R("price")},">0",{R("type")},{TC}),"-")').number_format = '$0.00'
st = SH + 1 + len(VIC)
M.cell(st, 2, 'VIC total')
for i in range(3, 8): M.cell(st, i, f'=SUM({L(i)}{SH + 1}:{L(i)}{st - 1})')
for i in range(8, 15):
    M.cell(st, i, f'=IF($C{st}=0,"-",SUMPRODUCT({L(i)}{SH + 1}:{L(i)}{st - 1},$C{SH + 1}:$C{st - 1})/$C{st})').number_format = '0%'
M.cell(st, 15, '-')
for r in range(SH + 1, st + 1):
    for i in range(2, 16):
        x = M.cell(r, i); x.border = B; x.font = Font(name='Arial', size=10, bold=(r == st))
        if i > 2: x.alignment = Alignment(horizontal='center')
        if r == st: x.fill = PatternFill('solid', fgColor='D9D9D9')
M.cell(st + 1, 2, 'Ranging % = share of locations marked 1. Avg price skips $0 and text. Locations with mixed QSR/vending fields only count where the field applies.').font = NOTE
# helper block: counts + cumulative starts
HB = 'AJ'
M[f'{HB}1'] = 'Helper: count'; M['AK1'] = 'Helper: start'
for j, u in enumerate(VIC):
    r = 2 + j; ii = info[u[0]]
    M[f'AJ{r}'] = f'=COUNT({q(u[0])}!${H_MKEY}${ii["lf"]}:${H_MKEY}${ii["ll"]})'
    M[f'AK{r}'] = '=0' if j == 0 else f'=AK{r - 1}+AJ{r - 1}'
tot_cell = f'$AJ${2 + len(VIC)}'
M[f'AJ{2 + len(VIC)}'] = f'=SUM(AJ2:AJ{1 + len(VIC)})'
MCOLS = [('uni', 'University', 22, None), ('id', 'Location ID', 12, None), ('type', 'Type', 9, None), ('name', 'Store/Location', 32, None),
         ('campus', 'Campus', 12, None), ('landmark', 'Landmark / Spot', 22, None), ('status', 'Status', 9, None), ('vstat', 'Visit Status', 17, None),
         ('lastv', 'Last Visit', 11, 'dd/mm/yyyy'), ('due', 'Next Due', 11, 'dd/mm/yyyy'), ('days', 'Days Until Due', 8, None),
         ('ed', 'ED', 6, None), ('zero', 'Zero', 6, None), ('sf', 'SF', 6, None), ('edition', 'Editions', 8, None), ('monster', 'Monster', 8, None),
         ('v', 'V', 6, None), ('pos', 'POS', 6, None), ('cooler', 'Cooler', 7, None), ('price', 'RB Price', 8, '$0.00'), ('topcomp', 'Top Competitor', 13, None),
         ('cv', 'Completed Visits', 9, None), ('dpa', 'DPs Added', 8, None), ('dpl', 'DPs Lost', 8, None), ('dpn', 'Net DPs', 8, '+0;-0;0'),
         ('eds', 'Editions Sold In', 9, None), ('posp', 'POS Placed', 8, None), ('ci', 'Coolers Installed', 9, None), ('co', 'Coolers Removed', 9, None),
         ('notes', 'Notes / Next Step', 40, None)]
MH = st + 4
M.cell(MH - 1, 2, f'="Locations: "&{tot_cell}&" shown"').font = Font(name='Arial', bold=True, size=11, color=NAVY)
for i, (k, h, w, f) in enumerate(MCOLS, 2): head(M, MH, i, h)
M.row_dimensions[MH].height = 30
MAXR = sum(info[u[0]]['ll'] - info[u[0]]['lf'] + 1 for u in VIC)
mf = MH + 1; ml = MH + MAXR
M['AL1'] = 'Helper: uni #'; M['AM1'] = 'Helper: row'
starts = f'$AK$2:$AK${1 + len(VIC)}'
for j in range(MAXR):
    r = mf + j; k = j + 1
    M[f'AL{r}'] = f'=IF({k}>{tot_cell},"",MATCH({k - 1},{starts},1))'
    parts = ','.join(f'MATCH({k}-$AK${2 + i},{q(u[0])}!${H_MKEY}${info[u[0]]["lf"]}:${H_MKEY}${info[u[0]]["ll"]},0)' for i, u in enumerate(VIC))
    M[f'AM{r}'] = f'=IF($AL{r}="","",CHOOSE($AL{r},{parts}))'
    for i, (key, h, w, f) in enumerate(MCOLS, 2):
        if key == 'uni':
            val = f'=IF($AL{r}="","",CHOOSE($AL{r},' + ','.join(f'"{u[1]}"' for u in VIC) + '))'
        else:
            ch = 'CHOOSE($AL' + str(r) + ',' + ','.join(f'INDEX({q(u[0])}!${LC[key]}${info[u[0]]["lf"]}:${LC[key]}${info[u[0]]["ll"]},$AM{r})' for u in VIC) + ')'
            val = f'=IF($AL{r}="","",IF({ch}="","",{ch}))'
        x = M.cell(r, i, val); x.font = BF; x.border = Border(bottom=Side(style='hair', color='D9D9D9'))
        if f: x.number_format = f
        if i >= 8 and key not in ('topcomp', 'notes'): x.alignment = Alignment(horizontal='center')
for c in ('AJ', 'AK', 'AL', 'AM'): M.column_dimensions[c].hidden = True
M.column_dimensions['A'].width = 3
for i, (k, h, w, f) in enumerate(MCOLS, 2): M.column_dimensions[L(i)].width = max(w, 10 if i <= 15 else w)
M.column_dimensions['B'].width = 24
status_cf(M, f'I{mf}:I{ml}', f'$I{mf}')
M.freeze_panes = M.cell(MH + 1, 6)

# ======================================================== 5. Progress
G = wb.create_sheet('Progress'); G.sheet_properties.tabColor = GREEN
G['A1'] = 'University Visit Progress'; G['A1'].font = Font(name='Arial', bold=True, size=16)
G['A3'] = 'Show'; G['A3'].font = Font(name='Arial', bold=True); G['A3'].alignment = Alignment(horizontal='right')
G['B3'] = 'All'; G['B3'].fill = SEL; G['B3'].font = Font(name='Arial', bold=True, color='0000FF'); G['B3'].border = B
dv(G, ['B3'], type='list', formula1='"All,QSR,Vending"')
G['C3'] = '=" Fortnightly snapshot as at "&TEXT(TODAY(),"dd mmm yyyy")&". Completed = an active location with a Completed visit in the last 14 days."'
G['C3'].font = NOTE
GT = 'IF($B$3="All","*",$B$3)'
pc = ['University', 'Active Locations', 'Required Visits', 'Completed Visits', 'Completion %', 'On Track', 'Overdue', 'No Visit Recorded']
P_H = 5
for i, h in enumerate(pc, 1): G.cell(P_H, i, h)
for j, u in enumerate(UNIS):
    r = P_H + 1 + j; ii = info[u[0]]; t = q(u[0])
    R = lambda k: f'{t}!${LC[k]}${ii["lf"]}:${LC[k]}${ii["ll"]}'
    G.cell(r, 1, u[1])
    G.cell(r, 2, f'=COUNTIFS({R("status")},"Active",{R("type")},{GT})')
    G.cell(r, 3, f'=B{r}')
    G.cell(r, 4, f'=COUNTIFS({R("status")},"Active",{R("type")},{GT},{R("lastv")},">="&TODAY()-14,{R("lastv")},"<="&TODAY())')
    G.cell(r, 5, f'=IFERROR(D{r}/C{r},0)').number_format = '0%'
    G.cell(r, 6, f'=COUNTIFS({R("status")},"Active",{R("type")},{GT},{R("vstat")},"On Track")+COUNTIFS({R("status")},"Active",{R("type")},{GT},{R("vstat")},"Due Soon")')
    G.cell(r, 7, f'=COUNTIFS({R("status")},"Active",{R("type")},{GT},{R("vstat")},"Overdue")')
    G.cell(r, 8, f'=COUNTIFS({R("status")},"Active",{R("type")},{GT},{R("vstat")},"No Visit Recorded")')
    for c in range(1, 9):
        G.cell(r, c).font = BF
        if c > 1: G.cell(r, c).alignment = Alignment(horizontal='center')
P_L = P_H + len(UNIS)
table(G, 'tblProgress', f'A{P_H}:H{P_L}')
for c in range(1, 9): G.cell(P_H, c).alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
G.row_dimensions[P_H].height = 30
tr = P_L + 1; G.cell(tr, 1, 'Total')
for c in range(2, 9):
    G.cell(tr, c, f'=IFERROR(D{tr}/C{tr},0)' if c == 5 else f'=SUM({L(c)}{P_H + 1}:{L(c)}{P_L})')
    G.cell(tr, c).alignment = Alignment(horizontal='center')
for c in range(1, 9): G.cell(tr, c).font = Font(name='Arial', bold=True); G.cell(tr, c).fill = PatternFill('solid', fgColor='D9D9D9')
G.cell(tr, 5).number_format = '0%'
G.cell(tr + 1, 1, 'On Track includes Due Soon (within 3 days). No Visit Recorded is shown separately; add it to Overdue for a stricter view.').font = NOTE
O_H = tr + 4
G.cell(O_H - 1, 1, '="Outcomes by university: "&IF($B$3="All","QSR + Vending",$B$3)&" (all Completed visits)"').font = Font(name='Arial', bold=True, size=11, color=NAVY)
oc = [('University', None), ('Completed Visits', 'cv'), ('DPs Added', 'dpa'), ('DPs Lost', 'dpl'), ('Net DPs', None), ('Editions Sold In', 'eds'),
      ('POS Placed', 'posp'), ('Coolers Installed', 'ci'), ('Coolers Removed', 'co'), ('Net Coolers', None)]
for i, (h, _) in enumerate(oc, 1): head(G, O_H, i, h)
G.row_dimensions[O_H].height = 30
for j, u in enumerate(UNIS):
    r = O_H + 1 + j; ii = info[u[0]]; t = q(u[0])
    R = lambda k: f'{t}!${LC[k]}${ii["lf"]}:${LC[k]}${ii["ll"]}'
    G.cell(r, 1, u[1])
    for i, (h, k) in enumerate(oc[1:], 2):
        if k: G.cell(r, i, f'=SUMIFS({R(k)},{R("type")},{GT})')
    G.cell(r, 5, f'=C{r}-D{r}'); G.cell(r, 10, f'=H{r}-I{r}')
ot = O_H + len(UNIS) + 1; G.cell(ot, 1, 'Total')
for c in range(2, 11): G.cell(ot, c, f'=SUM({L(c)}{O_H + 1}:{L(c)}{ot - 1})')
for r in range(O_H + 1, ot + 1):
    for c in range(1, 11):
        x = G.cell(r, c); x.border = B; x.font = Font(name='Arial', size=10, bold=(r == ot))
        if c > 1: x.alignment = Alignment(horizontal='center')
        if r == ot: x.fill = PatternFill('solid', fgColor='D9D9D9')
    G.cell(r, 5).number_format = G.cell(r, 10).number_format = '+0;-0;0'
Y_R = ot + 3
G.cell(Y_R, 1, '="Outcomes by month: "&IF($B$3="All","QSR + Vending",$B$3)').font = Font(name='Arial', bold=True, size=11, color=NAVY)
G.cell(Y_R, 3, 'Year').font = Font(name='Arial', bold=True)
G.cell(Y_R, 4, 2026); G.cell(Y_R, 4).font = Font(name='Arial', bold=True, color='0000FF'); G.cell(Y_R, 4).fill = SEL; G.cell(Y_R, 4).border = B
G.cell(Y_R, 5, '← change the year').font = NOTE
mc = [('Month', None), ('Completed Visits', None), ('Locations Visited', 'H'), ('DPs Added', 'a'), ('DPs Lost', 'l'), ('Net DPs', None),
      ('Editions Sold In', 'e'), ('POS Placed', 'p'), ('Coolers Installed', 'ci'), ('Coolers Removed', 'co'), ('Net Coolers', None)]
MH_ = Y_R + 1
for i, (h, _) in enumerate(mc, 1): head(G, MH_, i, h)
G.row_dimensions[MH_].height = 30
for m in range(1, 13):
    r = MH_ + m
    G.cell(r, 1, f'=DATE($D${Y_R},{m},1)').number_format = 'mmm yyyy'
    def summ(k):
        parts = []
        for u in UNIS:
            ii = info[u[0]]; t = q(u[0])
            V = lambda kk: f'{t}!${VC[kk]}${ii["vf"]}:${VC[kk]}${ii["vl"]}'
            crit = f'{V("vst")},"Completed",{V("vtype")},{GT},{V("date")},">="&$A{r},{V("date")},"<"&EDATE($A{r},1)'
            if k is None: parts.append(f'COUNTIFS({crit})')
            elif k == 'H': parts.append(f'SUMIFS({t}!${H_MONTH}${ii["vf"]}:${H_MONTH}${ii["vl"]},{crit})')
            else: parts.append(f'SUMIFS({V(k)},{crit})')
        return '=' + '+'.join(parts)
    G.cell(r, 2, summ(None))
    for i, (h, k) in enumerate(mc[2:], 3):
        if k: G.cell(r, i, summ(k))
    G.cell(r, 6, f'=D{r}-E{r}'); G.cell(r, 11, f'=I{r}-J{r}')
mt = MH_ + 13; G.cell(mt, 1, 'Year total')
for c in range(2, 12): G.cell(mt, c, f'=SUM({L(c)}{MH_ + 1}:{L(c)}{mt - 1})')
for r in range(MH_ + 1, mt + 1):
    for c in range(1, 12):
        x = G.cell(r, c); x.border = B; x.font = Font(name='Arial', size=10, bold=(r == mt))
        if c > 1: x.alignment = Alignment(horizontal='center')
        if r == mt: x.fill = PatternFill('solid', fgColor='D9D9D9')
    G.cell(r, 6).number_format = G.cell(r, 11).number_format = '+0;-0;0'
G.cell(mt + 1, 1, 'Locations Visited = distinct locations with a Completed visit that month.').font = NOTE
G.column_dimensions['A'].width = 26
for c in range(2, 12): G.column_dimensions[L(c)].width = 12
def bar(title, cols, colors, anchor):
    ch = BarChart(); ch.type = 'bar'; ch.grouping = 'clustered'; ch.title = title; ch.y_axis.title = 'Number of Locations'
    for col, color in zip(cols, colors):
        ch.add_data(Reference(G, min_col=col, min_row=P_H, max_row=P_L), titles_from_data=True)
        s = ch.series[-1]; s.graphicalProperties.solidFill = color; s.graphicalProperties.line.solidFill = color
    ch.set_categories(Reference(G, min_col=1, min_row=P_H + 1, max_row=P_L))
    ch.dataLabels = DataLabelList(); ch.dataLabels.showVal = True
    ch.x_axis.delete = False; ch.y_axis.delete = False; ch.x_axis.scaling.orientation = 'maxMin'
    ch.y_axis.majorGridlines = None; ch.legend.position = 'b'; ch.width = 17; ch.height = 9.5; ch.gapWidth = 60
    G.add_chart(ch, anchor)
bar('Fortnightly University Visit Progress', [3, 4], ['BFBFBF', '2F5597'], 'M3')
bar('Location Visit Status by University', [6, 7], ['70AD47', 'C00000'], 'M23')

# ======================================================== 6. Staff Management note, order, Index
order = ['Index', 'Progress', 'VIC Master', 'Staff Management'] + [u[0] for u in UNIS] + ['Calendar']
wb._sheets = [wb[n] for n in order]
I = wb['Index']
for row in I.iter_rows(min_row=1):
    for c in row: c.value = None; c.hyperlink = None
I['A1'] = 'Education Channel Execution Tracker'; I['A1'].font = Font(name='Arial', bold=True, size=14)
I['A2'] = 'Each university tab holds its QSR stores and vending machines in one list. Use the Show box to view either. Log visits on the university tab.'
I['A2'].font = NOTE
for i, h in enumerate(['Tab', 'What it’s for', 'QSR', 'Vending'], 1): head(I, 4, i, h)
desc = {'Progress': 'Fortnightly visit progress, outcomes by university and month, charts (QSR/Vending filter)',
        'VIC Master': 'Every VIC location in one filterable list + summary by university',
        'Staff Management': 'Who can be picked for visits at each university', 'Calendar': 'Month calendar (from the original files)'}
r = 5
for nme in order[1:]:
    x = I.cell(r, 1, nme); x.hyperlink = f'#{q(nme)}!A1'; x.font = Font(name='Arial', color='0563C1', underline='single', bold=True)
    if nme in info:
        ii = info[nme]
        I.cell(r, 2, f"{ii['full']}: locations, 14-day reminder, visit log").font = Font(name='Arial', color='595959')
        I.cell(r, 3, ii['nq']); I.cell(r, 4, ii['nv'])
        for c in (3, 4): I.cell(r, c).alignment = Alignment(horizontal='center'); I.cell(r, c).font = BF
    else:
        I.cell(r, 2, desc[nme]).font = Font(name='Arial', color='595959')
    r += 1
I.cell(r + 1, 1, 'QSR/vending counts are as loaded on 8 Oct 2026.').font = NOTE
I.column_dimensions['A'].width = 24; I.column_dimensions['B'].width = 70; I.column_dimensions['C'].width = 8; I.column_dimensions['D'].width = 9
wb.active = 0
for w in wb.worksheets: w.sheet_view.tabSelected = (w.title == 'Index')
wb.save(out_path)
for k, v in info.items(): print(k, {x: v[x] for x in ('n', 'nq', 'nv', 'lf', 'll', 'vf')})
