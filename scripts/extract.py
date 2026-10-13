import openpyxl, json, datetime as dt, re, sys
wb=openpyxl.load_workbook(sys.argv[1])  # raw values (inputs are static)
UN=[('Monash','Monash University','MON'),('La Trobe','La Trobe University','LTU'),('Deakin','Deakin University','DEA'),('Victoria University','Victoria University','VU'),('RMIT','RMIT University','RMIT'),('Swinburne','Swinburne University','SWI'),('Melbourne University','University of Melbourne','UOM'),('UTAS','University of Tasmania','UTAS')]
def iso(v): return v.strftime('%Y-%m-%d') if isinstance(v,dt.datetime) else None
def mask(v):
    if v in (None,''): return None
    s=str(v).strip()
    if re.search(r'\d{6,}',re.sub(r'\D','',s)): return '•••• (phone on file)'
    return s[0]+'•••' if s else None
unis=[];locs=[];visits=[];NAMES=set()
for tab,full,pre in UN:
    ws=wb[tab]
    L0=next(r for r in range(1,ws.max_row) if ws.cell(r,1).value=='Location ID' and ws.cell(r,5).value=='Address')
    hdr={ws.cell(L0,c).value:c for c in range(1,60) if ws.cell(L0,c).value}
    V0=next(r for r in range(L0+1,ws.max_row) if ws.cell(r,1).value=='Visit ID')
    vh={ws.cell(V0,c).value:c for c in range(1,30) if ws.cell(V0,c).value}
    campuses=set()
    for r in range(L0+1,V0):
        lid=ws.cell(r,1).value
        if not lid or not ws.cell(r,2).value or str(lid).startswith('VISITS'): continue
        raw_names=[str(x).strip() for x in (ws.cell(r,hdr['Contact']).value,) if x and re.match(r'^[A-Za-z]{3,}$',str(x).strip())]
        g=lambda h: ws.cell(r,hdr[h]).value
        d=dict(id=lid,uni=pre,type=g('Type'),name=g('Store/Location'),campus=g('Campus') or 'Unassigned',address=g('Address'),landmark=g('Landmark / Spot'),
               building=g('Building'),level=g('Level'),postcode=g('Postcode'),status=g('Status'),added=iso(g('Date Added')),cycle=g('Visit Cycle (days)') or 14,
               ranging={k:g(h) for k,h in [('ed','ED'),('sf','SF'),('zero','Zero'),('editions','Editions'),('monster','Monster'),('monsterUltra','Monster Ultra'),('v','V'),('vsf','V SF'),('vblue','V Blue'),('solo','Solo Energy')]},
               pos=g('POS'),cooler=g('Cooler'),price=g('Red Bull Price ($)') if isinstance(g('Red Bull Price ($)'),(int,float)) else None,topComp=g('Top Competitor'),
               compPrice=g('Competitor Price ($)') if isinstance(g('Competitor Price ($)'),(int,float)) else None,bull=g("Bullring / Bull's Eye"),channel=g('Channel'),
               classification=g('Classification'),indNka=g('IND / NKA'),pic=(str(g('Person-in-charge')).strip() if g('Person-in-charge') else None),contact=mask(g('Contact')),
               vendCo=g('Vending Company'),machineId=g('Machine ID'),vSku=g('V # of SKU'),vPrice=g('V Price ($)'),mSku=g('Monster # of SKU'),mPrice=g('Monster Price ($)'),notes=g('Notes / Next Step'))
        for k in ('building','level','postcode','vSku','mSku','vPrice','mPrice','machineId'):
            if d[k] is not None and not isinstance(d[k],(int,float)): d[k]=str(d[k])
        if d['postcode'] is not None: d['postcode']=str(d['postcode'])
        if d['channel']: d['channel']={'ONP':'OnP'}.get(str(d['channel']).strip().upper(),str(d['channel']).strip())
        for nm in raw_names:
            if d['notes']: d['notes']=re.sub(r'\b'+re.escape(nm)+r'\b', nm[0]+'•••', d['notes'])
        NAMES.update(raw_names)
        campuses.add(d['campus']); locs.append(d)
    for r in range(V0+1,ws.max_row+1):
        st=ws.cell(r,vh['Store/Location']).value
        if not st: continue
        loc=next((l for l in locs if l['uni']==pre and l['name']==st),None)
        visits.append(dict(id=f'{pre}-V{len([v for v in visits if v["uni"]==pre])+1:04d}',uni=pre,loc=loc['id'] if loc else None,date=iso(ws.cell(r,vh['Visit Date']).value),
             staff=ws.cell(r,vh['Staff Member']).value,status=ws.cell(r,vh['Visit Status']).value,notes=ws.cell(r,vh['Notes']).value,nextStep=ws.cell(r,vh['Next Step']).value,
             dpAdded=ws.cell(r,vh['DPs Added']).value or 0,dpLost=ws.cell(r,vh['DPs Lost']).value or 0,editions=ws.cell(r,vh['Editions Sold In']).value or 0,
             posPlaced=ws.cell(r,vh['POS Placed']).value or 0,coolersIn=ws.cell(r,vh['Coolers Installed']).value or 0,coolersOut=ws.cell(r,vh['Coolers Removed']).value or 0,imported=True))
    unis.append(dict(code=pre,name=full,short=tab,campuses=sorted(campuses)))
for v in visits:
    for nm in NAMES:
        if v['nextStep']: v['nextStep']=re.sub(r'\b'+re.escape(nm)+r'\b', nm[0]+'•••', v['nextStep'])
S=wb['Staff Management']; alloc=[]
for r in range(2,S.max_row+1):
    if S.cell(r,1).value: alloc.append(dict(staff=S.cell(r,1).value,uni=S.cell(r,2).value,campus=S.cell(r,3).value,status=S.cell(r,4).value))
code={u['name']:u['code'] for u in unis}
for a in alloc: a['uni']=code[a['uni']]
out=dict(unis=unis,locations=locs,visits=visits,allocations=alloc,asOf='2026-10-08')
PH=re.compile(r'(\+?61|0)[\d\s\u202c\u202d-]{8,13}\d')
def scrub(t):
    if not t: return t
    t=PH.sub('[phone removed]',str(t))
    for nm in NAMES: t=re.sub(r'\b'+re.escape(nm)+r'\b', nm[0].upper()+'•••', t, flags=re.I)
    return t
for l in locs: l['notes']=scrub(l['notes'])
for v in visits: v['nextStep']=scrub(v['nextStep'])
json.dump(out,open(sys.argv[2],'w'),separators=(',',':'),default=str)
print(len(locs),len(visits),len(alloc),[ (u['code'],u['campuses']) for u in unis])
print(sum(1 for l in locs if l['pic'] or l['contact']),'with contacts (masked)')
