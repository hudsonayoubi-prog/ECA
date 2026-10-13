import sys, re, openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as L
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule, FormulaRule
p=sys.argv[1]; wb=openpyxl.load_workbook(p)
for n in ['Visit Log','VIC Progress']:
    if n in wb.sheetnames: del wb[n]
NAVY='1F3864'; GREEN='375623'; thin=Side(style='thin',color='BFBFBF'); B=Border(left=thin,right=thin,top=thin,bottom=thin)
HF=Font(name='Arial',bold=True,color='FFFFFF',size=10); BF=Font(name='Arial',size=10)
AUTO=PatternFill('solid',fgColor='EDEDED'); INP=PatternFill('solid',fgColor='FFF2CC'); PG=PatternFill('solid',fgColor='E2EFDA')
def hdr(ws,r,c,t,fill=NAVY):
    x=ws.cell(r,c,t); x.font=HF; x.fill=PatternFill('solid',fgColor=fill); x.alignment=Alignment(horizontal='center',vertical='center',wrap_text=True); x.border=B; return x
M=wb['VIC Master']; H=17
hdrs={M.cell(H,c).value:c for c in range(1,M.max_column+1)}
first=H+1; last=max(r for r in range(first,M.max_row+1) if M.cell(r,2).value)
cA=hdrs['Account']; cLV=hdrs['Last Visit']; cNS=hdrs['Next Step']; cCamp=hdrs['Campus']
PRE={'Deakin':'DEA','La Trobe':'LTU','Melb Uni':'UOM','Monash':'MON','RMIT':'RMIT','Swinburne':'SWI','VU':'VU'}
LOG="'Visit Log'"; LR=(6,2005)
def lr(col): return f"{LOG}!${col}${LR[0]}:${col}${LR[1]}"
# ---- master: Account ID + progress block
P0=cNS+1
pcols=['Account ID','Visits logged','Latest visit','Days since visit','DPs added','DPs lost','Net DPs','Editions sold in','POS placed','Coolers installed','Coolers removed','Latest outcome','Next visit due']
M.merge_cells(start_row=H-1,start_column=P0,end_row=H-1,end_column=P0+len(pcols)-1)
hdr(M,H-1,P0,'ACCOUNT PROGRESS  (rolls up automatically from the Visit Log tab)',GREEN)
M.merge_cells(start_row=H-1,start_column=4,end_row=H-1,end_column=cNS)
hdr(M,H-1,4,'ACCOUNT DETAILS  (live from each university tab)')
for i,t in enumerate(pcols): hdr(M,H,P0+i,t,GREEN)
cnt={}
for r in range(first,last+1):
    uni=M.cell(r,2).value; cnt[uni]=cnt.get(uni,0)+1
    m=re.match(r"=IF\('(.+?)'!([A-Z]+\d+)=",str(M.cell(r,cA).value)); name=''
    if m: name=str(wb[m.group(1)][m.group(2)].value or '').strip()
    aid=f"{PRE[uni]}-{cnt[uni]:03d} · {name}"
    C=lambda i: M.cell(r,P0+i); D=f"${L(P0)}{r}"
    C(0).value=aid
    C(1).value=f'=COUNTIF({lr("B")},{D})'
    C(2).value=f'=IF(AND({L(P0+1)}{r}=0,N({L(cLV)}{r})=0),"",MAX(N({L(cLV)}{r}),_xlfn.MAXIFS({lr("A")},{lr("B")},{D})))'
    C(3).value=f'=IF({L(P0+2)}{r}="","",TODAY()-{L(P0+2)}{r})'
    for i,col in [(4,'G'),(5,'H'),(7,'K'),(8,'M'),(9,'O'),(10,'P')]:
        C(i).value=f'=IF({L(P0+1)}{r}=0,"",SUMIFS({lr(col)},{lr("B")},{D}))'
    C(6).value=f'=IF({L(P0+1)}{r}=0,"",{L(P0+4)}{r}-{L(P0+5)}{r})'
    mx=f'_xlfn.MAXIFS({lr("A")},{lr("B")},{D})'
    C(11).value=f'=IF({L(P0+1)}{r}=0,"",IFERROR(LOOKUP(2,1/(({lr("B")}={D})*({lr("A")}={mx})),{lr("S")}),""))'
    C(12).value=f'=IF({L(P0+1)}{r}=0,"",IFERROR(1/(1/LOOKUP(2,1/(({lr("B")}={D})*({lr("A")}={mx})),{lr("U")})),""))'
    for i in range(len(pcols)):
        c=C(i); c.font=BF; c.border=B; c.fill=PG if i else PatternFill(None)
        if 0<i<11: c.alignment=Alignment(horizontal='center')
    C(2).number_format=C(12).number_format='dd/mm/yyyy'; C(6).number_format='+0;-0;0'
widths=[30,9,12,10,9,9,9,10,9,10,10,50,12]
for i,w in enumerate(widths): M.column_dimensions[L(P0+i)].width=w
dr=f"{L(P0+3)}{first}:{L(P0+3)}{last}"
M.conditional_formatting.add(dr,FormulaRule(formula=[f'AND(ISNUMBER({L(P0+3)}{first}),{L(P0+3)}{first}>60)'],fill=PatternFill('solid',fgColor='F4B6B6')))
M.conditional_formatting.add(dr,FormulaRule(formula=[f'AND(ISNUMBER({L(P0+3)}{first}),{L(P0+3)}{first}>30,{L(P0+3)}{first}<=60)'],fill=PatternFill('solid',fgColor='FFE699')))
nd=f"{L(P0+6)}{first}:{L(P0+6)}{last}"
M.conditional_formatting.add(nd,CellIsRule(operator='lessThan',formula=['0'],font=Font(color='C00000',bold=True)))
M.auto_filter.ref=f"A{H}:{L(P0+len(pcols)-1)}{last}"
M.freeze_panes=M.cell(H+1,cA+1)
M['A3']='Account Progress (green columns) fills in automatically from the Visit Log. Days since visit: amber = 31–60 days, red = 60+ days.'
M['A3'].font=Font(name='Arial',italic=True,size=9,color='375623')
IDR=f"'VIC Master'!${L(P0)}${first}:${L(P0)}${last}"; UNR=f"'VIC Master'!$B${first}:$B${last}"; CAR=f"'VIC Master'!${L(cCamp)}${first}:${L(cCamp)}${last}"
# ---- Visit Log
V=wb.create_sheet('Visit Log',3); V.sheet_properties.tabColor=GREEN
V['A1']='Visit Log: one row per account visit'; V['A1'].font=Font(name='Arial',bold=True,size=14)
V['A2']='Fill in the yellow columns; the grey columns fill themselves. Pick the account from the dropdown, which lists every account on the VIC Master. Leave a number blank if nothing changed.'
V['A2'].font=Font(name='Arial',italic=True,size=9,color='666666')
V['A3']='DP (distribution point) = one SKU ranged in one account. e.g. adding ED + Zero to a new fridge = 2 DPs added; delisting Editions Red = 1 DP lost.'
V['A3'].font=Font(name='Arial',italic=True,size=9,color='666666')
cols=[('Date',12,'in'),('Account',34,'in'),('University',12,'auto'),('Campus',16,'auto'),('Visited by',14,'in'),('Visit type',16,'in'),
 ('DPs added',9,'in'),('DPs lost',9,'in'),('Net DPs',9,'auto'),('SKUs added / lost (detail)',26,'in'),('Editions sold in (#)',10,'in'),('Editions flavours',18,'in'),
 ('POS placed (#)',9,'in'),('POS type',14,'in'),('Coolers installed',10,'in'),('Coolers removed',10,'in'),('Red Bull price ($)',10,'in'),
 ('Competitor activity',26,'in'),('Outcome / notes',40,'in'),('Next step',30,'in'),('Next visit date',12,'in')]
for i,(t,w,k) in enumerate(cols,1):
    hdr(V,5,i,t,NAVY if k=='in' else '7F7F7F'); V.column_dimensions[L(i)].width=w
V.row_dimensions[5].height=42
ex=['12/10/2026','MON-001 · Grafali\'s','Monash','Monash Clayton','Keane','Sell-in','2','1','1','+ED 355, +Zero / – Editions Blue','1','Editions Red','2','Price tag','0','0','3.50','Monster sampling at front counter','New single-door fridge ranged, price tags placed','Check sell-through, top up POS','26/10/2026']
V['A4']='EXAMPLE →'; 
for i,v in enumerate(ex,1):
    c=V.cell(4,i,v if i>1 else 'e.g. '+v); c.font=Font(name='Arial',italic=True,size=9,color='808080')
for r in range(LR[0],LR[1]+1):
    V.cell(r,3,f'=IF($B{r}="","",INDEX({UNR},MATCH($B{r},{IDR},0)))')
    V.cell(r,4,f'=IF($B{r}="","",INDEX({CAR},MATCH($B{r},{IDR},0)))')
    V.cell(r,9,f'=IF(AND(G{r}="",H{r}=""),"",N(G{r})-N(H{r}))')
    V.cell(r,22,f'=IF(OR(A{r}="",B{r}=""),"",IF(COUNTIFS(B${LR[0]}:B{r},B{r},A${LR[0]}:A{r},">="&(EOMONTH(A{r},-1)+1),A${LR[0]}:A{r},"<="&EOMONTH(A{r},0))=1,1,0))')
    for i,(t,w,k) in enumerate(cols,1):
        c=V.cell(r,i); c.font=BF; c.border=B; c.fill=AUTO if k=='auto' else PatternFill(None)
    V.cell(r,1).number_format=V.cell(r,21).number_format='dd/mm/yyyy'; V.cell(r,17).number_format='$0.00'; V.cell(r,9).number_format='+0;-0;0'
rng=lambda c: f"{c}{LR[0]}:{c}{LR[1]}"
def dv(**kw):
    d=DataValidation(allow_blank=True,showErrorMessage=True,**kw); V.add_data_validation(d); return d
dv(type='list',formula1=f"={IDR}",errorTitle='Pick an account',error='Choose an account from the list (it comes from the VIC Master).').add(rng('B'))
dv(type='list',formula1='"Routine visit,Sell-in,POS install,Cooler install,Cooler service,Follow-up,Phone / email,Event / activation"').add(rng('F'))
dv(type='list',formula1='"Price tag,Wobbler,Poster,Shelf strip,Fridge decal,Counter unit,Menu board,Other"').add(rng('N'))
_d=dv(type='date',operator='greaterThan',formula1='DATE(2020,1,1)',error='Enter a date, e.g. 12/10/2026')
for _c in 'AU': _d.add(rng(_c))
_w=dv(type='whole',operator='between',formula1='0',formula2='200',error='Enter a whole number (0 or more).')
for _c in 'GHKMOP': _w.add(rng(_c))
V.cell(5,22,'Helper: first visit this month'); V.column_dimensions['V'].hidden=True
V.freeze_panes='C6'; V.auto_filter.ref=f"A5:U{LR[1]}"
V.conditional_formatting.add(rng('I'),CellIsRule(operator='lessThan',formula=['0'],font=Font(color='C00000',bold=True)))
for c in 'ABEFGHJKLMNOPQRSTU': V[f'{c}5'].fill=PatternFill('solid',fgColor=NAVY)
for r in range(LR[0],LR[1]+1):
    for c in 'ABEFGHJKLMNOPQRSTU': V[f'{c}{r}'].fill=INP if r==LR[0] else PatternFill(None)
# input band tint on header row only + first row; keep sheet light
# ---- VIC Progress
G=wb.create_sheet('VIC Progress',4); G.sheet_properties.tabColor=GREEN
G['A1']='VIC Progress: outcomes from the Visit Log'; G['A1'].font=Font(name='Arial',bold=True,size=14)
G['A3']='Year'; G['A3'].font=Font(name='Arial',bold=True); G['B3']=2026; G['B3'].fill=INP; G['B3'].font=Font(name='Arial',bold=True,color='0000FF'); G['B3'].border=B
G['C3']='← change to see another year (monthly table)'; G['C3'].font=Font(name='Arial',italic=True,size=9,color='666666')
G['A5']='By university (all time)'; G['A5'].font=Font(name='Arial',bold=True,size=11)
t1=['University','Accounts','Accounts with a logged visit','Visits logged','DPs added','DPs lost','Net DPs','Editions sold in','POS placed','Coolers installed','Coolers removed','Net coolers','Overdue 30+ days','No visit on record']
for i,t in enumerate(t1,1): hdr(G,6,i,t)
G.row_dimensions[6].height=44
MV=lambda off: f"'VIC Master'!${L(P0+off)}${first}:${L(P0+off)}${last}"
UNIS=['Deakin','La Trobe','Melb Uni','Monash','RMIT','Swinburne','VU']
for j,u in enumerate(UNIS):
    r=7+j; G.cell(r,1,u)
    G.cell(r,2,f'=COUNTIF({UNR},A{r})')
    G.cell(r,3,f'=COUNTIFS({UNR},A{r},{MV(1)},">0")')
    G.cell(r,4,f'=COUNTIF({lr("C")},A{r})')
    for c,col in [(5,'G'),(6,'H'),(8,'K'),(9,'M'),(10,'O'),(11,'P')]: G.cell(r,c,f'=SUMIFS({lr(col)},{lr("C")},A{r})')
    G.cell(r,7,f'=E{r}-F{r}'); G.cell(r,12,f'=J{r}-K{r}')
    G.cell(r,13,f'=COUNTIFS({UNR},A{r},{MV(3)},">30")')
    G.cell(r,14,f'=SUMPRODUCT(({UNR}=A{r})*({MV(2)}=""))')
tr=7+len(UNIS); G.cell(tr,1,'VIC total')
for c in range(2,15): G.cell(tr,c,f'=SUM({L(c)}7:{L(c)}{tr-1})')
for r in range(7,tr+1):
    for c in range(1,15):
        x=G.cell(r,c); x.border=B; x.font=Font(name='Arial',size=10,bold=(r==tr))
        if c>1: x.alignment=Alignment(horizontal='center')
        if r==tr: x.fill=PatternFill('solid',fgColor='D9D9D9')
    G.cell(r,7).number_format=G.cell(r,12).number_format='+0;-0;0'
mr=tr+3; G.cell(mr,1,'By month (year in B3)').font=Font(name='Arial',bold=True,size=11)
t2=['Month','Visits logged','Accounts visited','DPs added','DPs lost','Net DPs','Editions sold in','POS placed','Coolers installed','Coolers removed','Net coolers']
for i,t in enumerate(t2,1): hdr(G,mr+1,i,t)
G.row_dimensions[mr+1].height=32
for m in range(1,13):
    r=mr+1+m; G.cell(r,1,f'=DATE($B$3,{m},1)').number_format='mmm yyyy'
    s=f'{lr("A")},">="&$A{r},{lr("A")},"<"&EDATE($A{r},1)'
    G.cell(r,2,f'=COUNTIFS({s})')
    G.cell(r,3,f'=SUMIFS({lr("V")},{s})')
    for c,col in [(4,'G'),(5,'H'),(7,'K'),(8,'M'),(9,'O'),(10,'P')]: G.cell(r,c,f'=SUMIFS({lr(col)},{s})')
    G.cell(r,6,f'=D{r}-E{r}'); G.cell(r,11,f'=I{r}-J{r}')
tot=mr+14; G.cell(tot,1,'Year total')
for c in range(2,12):
    G.cell(tot,c,f'=SUM({L(c)}{mr+2}:{L(c)}{tot-1})' if c!=3 else '')
G.cell(tot,3,'–')
for r in range(mr+2,tot+1):
    for c in range(1,12):
        x=G.cell(r,c); x.border=B; x.font=Font(name='Arial',size=10,bold=(r==tot))
        if c>1: x.alignment=Alignment(horizontal='center')
        if r==tot: x.fill=PatternFill('solid',fgColor='D9D9D9')
    G.cell(r,6).number_format=G.cell(r,11).number_format='+0;-0;0'
G.cell(tot+2,1,'Accounts visited = distinct accounts with at least one visit that month. Net = added minus removed/lost.').font=Font(name='Arial',italic=True,size=9,color='666666')
for c in range(1,15): G.column_dimensions[L(c)].width=13
G.column_dimensions['A'].width=14
for rng_ in [f'G7:G{tr}',f'F{mr+2}:F{tot}']:
    G.conditional_formatting.add(rng_,CellIsRule(operator='lessThan',formula=['0'],font=Font(color='C00000',bold=True)))
# ---- Index
I=wb['Index']
vals=[(I.cell(r,1).value,I.cell(r,2).value,I.cell(r,3).value) for r in range(5,I.max_row+1) if I.cell(r,2).value]
vals=[v for v in vals if v[1] not in('Visit Log','VIC Progress')]
for row in I.iter_rows(min_row=5):
    for c in row: c.value=None; c.hyperlink=None
vals=vals[:2]+[('VIC','Visit Log','Built here: log every visit and its outcomes'),('VIC','VIC Progress','Built here: outcomes by university and month')]+vals[2:]
for r,(a,b,c) in enumerate(vals,5):
    I.cell(r,1,a).font=Font(name='Arial'); x=I.cell(r,2,b); x.hyperlink=f"#'{b}'!A1"; x.font=Font(name='Arial',color='0563C1',underline='single',bold=c.startswith('Built'))
    I.cell(r,3,c).font=Font(name='Arial',color='666666')
I.cell(r+2,1,'The Uni Melb and RMIT files each had an identical Calendar tab; it appears once here.').font=Font(name='Arial',italic=True,color='666666')
I.cell(r+3,1,'Other states: copy the VIC Master layout when their university tabs are added.').font=Font(name='Arial',italic=True,color='666666')
wb.save(p); print('accounts',last-first+1,'progress col',L(P0))
