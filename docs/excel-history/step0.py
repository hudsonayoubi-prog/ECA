import sys, openpyxl
p=sys.argv[1]; wb=openpyxl.load_workbook(p)
for n in ['Visit Log','VIC Progress','VIC Master','VIC Master (Vending)']:
    if n in wb.sheetnames: del wb[n]
REN={'Deakin':'Deakin Audit','Deakin (Vending)':'Deakin Vending','La Trobe':'La Trobe Audit','La Trobe (Vending)':'La Trobe Vending',
'Melb Uni':'Melbourne Uni Audit','Melb Uni (Vending)':'Melbourne Uni Vending','CLAYTON MONASH':'Monash Clayton Audit','CAULFIELD MONASH':'Monash Caulfield Audit',
'RMIT (CBD)':'RMIT Audit','RMIT (Vending)':'RMIT Vending','VIC UNI (Footscray)':'Victoria Uni Audit','VIC UNI (Footscray Vending)':'Victoria Uni Vending',
'Swinburne University':'Swinburne Audit','Swinburne University (Vending)':'Swinburne Vending','{University Name}':'Template Audit','{University Name} (Vending)':'Template Vending'}
for o,n in REN.items(): wb[o].title=n
wb.save(p); print(wb.sheetnames)
