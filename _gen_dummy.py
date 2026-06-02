import os, csv, random, sys
sys.stdout.reconfigure(encoding='utf-8')

os.makedirs('data', exist_ok=True)

# All data sheets with their exact field names from the Excel reference
datasets = {
    '01_PR_Dump': [
        'purchase_requisition', 'item_of_requisition', 'purchasing_doc_type',
        'vendor', 'material_group', 'material_description', 'plant',
        'purchasing_group', 'order_quantity', 'unit_of_measure',
        'valuation_price', 'delivery_date', 'release_status', 'release_date',
        'requisitioner', 'tracking_number'
    ],
    '02_PO_Dump': [
        'purchasing_document', 'item', 'purchasing_doc_type', 'purchasing_org',
        'purchasing_group', 'vendor', 'vendor_name', 'document_date', 'plant',
        'material_group', 'material_description', 'order_quantity',
        'unit_of_measure', 'net_order_price', 'net_order_value', 'tax_code',
        'purchase_requisition', 'release_indicator', 'release_strategy',
        'delivery_completed'
    ],
    '03_PO_Delivery_Dump': [
        'purchasing_document', 'item', 'schedule_line', 'expected_delivery_date',
        'scheduled_quantity', 'delivered_quantity', 'open_quantity',
        'statistical_delivery_date', 'creation_date', 'actual_delivery_date'
    ],
    '04_GRN_Dump': [
        'purchasing_document', 'item', 'material_document', 'material_doc_item',
        'po_history_category', 'movement_type', 'debit_credit_ind',
        'posting_date', 'entry_date', 'quantity', 'amount_local_ccy',
        'reference_doc'
    ],
    '05_PO_Invoice_Dump': [
        'purchasing_document', 'item', 'invoice_doc', 'invoice_year',
        'invoice_doc_item', 'po_history_category', 'debit_credit_ind',
        'posting_date', 'entry_date', 'quantity', 'amount_local_ccy',
        'reference_doc'
    ],
    '06_Invoice_Dump': [
        'invoice_doc', 'invoice_year', 'vendor', 'document_type',
        'vendor_invoice_ref', 'vendor_invoice_date', 'posting_date', 'due_date',
        'amount_local_ccy', 'tax_amount', 'payment_terms', 'payment_block',
        'po_reference', 'clearing_doc'
    ],
    '07_Payment_Dump': [
        'payment_doc', 'payment_year', 'vendor', 'document_type',
        'posting_date', 'clearing_date', 'payment_method', 'amount_local_ccy',
        'discount_taken', 'cleared_invoice', 'bank_reference', 'house_bank'
    ],
    '08_Vendor_Master': [
        'vendor', 'vendor_name', 'country', 'city', 'postal_code', 'region',
        'account_group', 'tax_number_pan', 'tax_number_gstin',
        'central_purchasing_block', 'central_posting_block',
        'deletion_flag_central', 'company_code', 'payment_terms',
        'payment_block', 'posting_block_cc'
    ],
    '09_Change_Log': [
        'object_class', 'object_id', 'change_number', 'username',
        'change_date', 'change_time', 'tcode', 'table_name', 'field_name',
        'change_indicator', 'old_value', 'new_value'
    ]
}

# === HELPERS ===
def pick(seq): return random.choice(seq)

def rdate(start='2022-01-01', end='2022-12-31'):
    from datetime import datetime, timedelta
    s = datetime.strptime(start, '%Y-%m-%d')
    e = datetime.strptime(end, '%Y-%m-%d')
    d = s + timedelta(days=random.randint(0, (e-s).days))
    return d.strftime('%Y-%m-%d')

def rtime():
    h = random.randint(8, 18)
    m = random.randint(0, 59)
    s = random.randint(0, 59)
    return f'{h:02d}:{m:02d}:{s:02d}'

# === FIXED REFERENCE DATA ===
VENDORS = [
    ('732880','BV Test 2'), ('700100','Tata Steel Ltd'), ('700200','Reliance Industries'),
    ('700300','HCL Technologies'), ('700400','Bharat Heavy Electricals'),
    ('700500','Larsen & Toubro'), ('700600','ITC Limited'), ('700700','Wipro Ltd'),
    ('700800','Adani Enterprises'), ('700900','Mahindra & Mahindra'),
]
VENDOR_DETAILS = [
    ('IN','Mumbai','400001','MH','ZSER','AAACI4741P','29AAACI4741P1ZF',''),
    ('IN','Bengaluru','560100','KA','ZSER','AABCJ1234P','29AABCJ1234P1ZF',''),
    ('IN','Delhi','110001','DL','ZSRV','AABCR5678P','29AABCR5678P1ZF',''),
    ('IN','Chennai','600001','TN','ZSRV','AABCL9012P','29AABCL9012P1ZF',''),
    ('IN','Hyderabad','500001','TS','ZSER','AABCM3456P','29AABCM3456P1ZF',''),
    ('IN','Kolkata','700001','WB','ZSER','AABCN7890P','29AABCN7890P1ZF',''),
    ('IN','Pune','411001','MH','ZSRV','AABCO1111P','29AABCO1111P1ZF',''),
    ('IN','Ahmedabad','380001','GJ','ZSER','AABCP2222P','29AABCP2222P1ZF',''),
    ('IN','Jaipur','302001','RJ','ZSRV','AABCQ3333P','29AABCQ3333P1ZF',''),
    ('IN','Lucknow','226001','UP','ZSER','AABCR4444P','29AABCR4444P1ZF',''),
]
MATERIALS = [
    ('9901','IT Hardware','PC001'), ('9902','Civil Works','CV002'),
    ('9903','Electrical','EL003'), ('9904','Chemical','CH004'),
    ('9905','Office Supplies','OS005'), ('9906','Packaging','PK006'),
    ('9907','Safety Equipment','SE007'), ('9908','Raw Material','RM008'),
    ('9909','Consulting','CS009'), ('9910','Transport','TR010'),
]
MAT_DESC = [
    'Dismantling of Structures','Laptop Dell Latitude 5420','Cement 43 Grade OPC',
    'Transformer 11kV','Chemical Reagent X','A4 Paper 80gsm','Corrugated Boxes',
    'Safety Helmets','Steel Coil HR','Management Consulting Services',
    'Freight Services','Server Rack 42U','Office Chairs','LED Panel 24W',
]
PLANTS = ['SDPL','MNAL','DELP','BLRP','HYDP']
P_GROUPS = ['SER','MAT','CSR','LOG','ADM']
DOC_TYPES_PR = ['NB','ZAN','ZFO']
DOC_TYPES_PO = ['ZAN','NB','FO']
UOMS = ['EA','KG','M','BOX','LTR','NOS']
USERS = ['RKUMAR','SVERMA','AGUPTA','PDESAI','MSINGH','AKHANNA','VSHARMA']
TAX_CODES = ['I0','I5','I12','I18']
RELEASE_STRATS = ['PO_L4','PO_L3','PO_L2','PO_L1']

# =============================================
# 01 — PR DUMP
# =============================================
rows = []
for i in range(1, 31):
    v = pick(VENDORS)
    m = pick(MATERIALS)
    pr_num = f'1000{str(random.randint(3478,9999))}'
    rows.append({
        'purchase_requisition': pr_num,
        'item_of_requisition': f'000{i:02d}'[-5:],
        'purchasing_doc_type': pick(DOC_TYPES_PR),
        'vendor': v[0],
        'material_group': m[0],
        'material_description': pick(MAT_DESC),
        'plant': pick(PLANTS),
        'purchasing_group': pick(P_GROUPS),
        'order_quantity': round(random.uniform(1,500),3),
        'unit_of_measure': pick(UOMS),
        'valuation_price': round(random.uniform(500,150000),2),
        'delivery_date': rdate('2022-03-01','2022-09-30'),
        'release_status': pick(['X','XX','XXX','XXXX','']),
        'release_date': rdate('2022-03-01','2022-09-30'),
        'requisitioner': pick(USERS),
        'tracking_number': f'TRK-{random.randint(1000,9999)}' if random.random()>0.3 else '',
    })

with open('data/01_PR_Dump.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=datasets['01_PR_Dump'])
    w.writeheader(); w.writerows(rows)
print(f'01_PR_Dump: {len(rows)} rows')

# =============================================
# 02 — PO DUMP
# =============================================
rows = []
for i in range(1, 31):
    v = pick(VENDORS)
    m = pick(MATERIALS)
    po_num = f'200000{random.randint(1000,9999)}'
    pr_num = f'1000{random.randint(3478,9999)}' if random.random()>0.15 else ''
    nop = round(random.uniform(500,150000),2)
    nov = round(nop * random.uniform(0.5,50),2)
    rows.append({
        'purchasing_document': po_num,
        'item': f'000{i:02d}'[-5:],
        'purchasing_doc_type': pick(DOC_TYPES_PO),
        'purchasing_org': random.choice(['1000','2000','3000']),
        'purchasing_group': pick(P_GROUPS),
        'vendor': v[0],
        'vendor_name': v[1],
        'document_date': rdate('2022-04-01','2022-12-31'),
        'plant': pick(PLANTS),
        'material_group': m[0],
        'material_description': pick(MAT_DESC),
        'order_quantity': round(random.uniform(1,100),3),
        'unit_of_measure': pick(UOMS),
        'net_order_price': nop,
        'net_order_value': nov,
        'tax_code': pick(TAX_CODES),
        'purchase_requisition': pr_num,
        'release_indicator': pick(['X','','R']),
        'release_strategy': pick(RELEASE_STRATS),
        'delivery_completed': pick(['X','']),
    })

with open('data/02_PO_Dump.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=datasets['02_PO_Dump'])
    w.writeheader(); w.writerows(rows)
print(f'02_PO_Dump: {len(rows)} rows')

# =============================================
# 03 — PO DELIVERY DUMP
# =============================================
rows = []
for i in range(1, 31):
    po_num = f'200000{random.randint(1000,9999)}'
    sched_qty = round(random.uniform(10,500),3)
    del_qty = round(sched_qty * random.uniform(0,1.2),3)
    rows.append({
        'purchasing_document': po_num,
        'item': f'000{i:02d}'[-5:],
        'schedule_line': f'{i:04d}',
        'expected_delivery_date': rdate('2022-05-01','2022-12-31'),
        'scheduled_quantity': sched_qty,
        'delivered_quantity': del_qty,
        'open_quantity': round(max(0, sched_qty-del_qty),3),
        'statistical_delivery_date': rdate('2022-05-01','2022-12-31'),
        'creation_date': rdate('2022-04-01','2022-12-15'),
        'actual_delivery_date': rdate('2022-05-15','2023-01-15'),
    })

with open('data/03_PO_Delivery_Dump.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=datasets['03_PO_Delivery_Dump'])
    w.writeheader(); w.writerows(rows)
print(f'03_PO_Delivery_Dump: {len(rows)} rows')

# =============================================
# 04 — GRN DUMP
# =============================================
rows = []
for i in range(1, 31):
    dc = pick(['S','H']) if random.random()>0.9 else 'S'
    mt = '122' if dc=='H' else pick(['101','102','103'])
    rows.append({
        'purchasing_document': f'200000{random.randint(1000,9999)}',
        'item': f'000{i:02d}'[-5:],
        'material_document': f'5000{random.randint(100000,999999)}',
        'material_doc_item': f'{i:04d}',
        'po_history_category': 'E',
        'movement_type': mt,
        'debit_credit_ind': dc,
        'posting_date': rdate('2022-06-01','2023-01-31'),
        'entry_date': rdate('2022-06-01','2023-01-31'),
        'quantity': round(random.uniform(1,100),3),
        'amount_local_ccy': round(random.uniform(5000,500000),2),
        'reference_doc': f'DN-2022-{random.randint(100,999)}' if random.random()>0.3 else '',
    })

with open('data/04_GRN_Dump.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=datasets['04_GRN_Dump'])
    w.writeheader(); w.writerows(rows)
print(f'04_GRN_Dump: {len(rows)} rows')

# =============================================
# 05 — PO INVOICE DUMP
# =============================================
rows = []
for i in range(1, 31):
    dc = pick(['S','H']) if random.random()>0.9 else 'S'
    rows.append({
        'purchasing_document': f'200000{random.randint(1000,9999)}',
        'item': f'000{i:02d}'[-5:],
        'invoice_doc': f'5105{random.randint(100000,999999)}',
        'invoice_year': '2022',
        'invoice_doc_item': f'{i:04d}',
        'po_history_category': 'Q',
        'debit_credit_ind': dc,
        'posting_date': rdate('2022-07-01','2023-02-28'),
        'entry_date': rdate('2022-07-01','2023-02-28'),
        'quantity': round(random.uniform(1,100),3),
        'amount_local_ccy': round(random.uniform(5000,500000),2),
        'reference_doc': f'INV-2022-{random.randint(1000,9999)}',
    })

with open('data/05_PO_Invoice_Dump.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=datasets['05_PO_Invoice_Dump'])
    w.writeheader(); w.writerows(rows)
print(f'05_PO_Invoice_Dump: {len(rows)} rows')

# =============================================
# 06 — INVOICE DUMP
# =============================================
rows = []
for i in range(1, 31):
    v = pick(VENDORS)
    amt = round(random.uniform(5000,2000000),2)
    tax = round(amt * random.uniform(0.05,0.18),2)
    rows.append({
        'invoice_doc': f'19000{random.randint(10000,99999)}',
        'invoice_year': '2022',
        'vendor': v[0],
        'document_type': pick(['KR','RE']),
        'vendor_invoice_ref': f'INV-2022-{random.randint(1000,9999)}',
        'vendor_invoice_date': rdate('2022-06-01','2022-12-31'),
        'posting_date': rdate('2022-06-15','2023-01-31'),
        'due_date': rdate('2022-07-15','2023-03-15'),
        'amount_local_ccy': amt,
        'tax_amount': tax,
        'payment_terms': pick(['N030','N045','N060','I001']),
        'payment_block': pick(['','*']) if random.random()>0.85 else '',
        'po_reference': f'200000{random.randint(1000,9999)}' if random.random()>0.3 else '',
        'clearing_doc': f'29000{random.randint(10000,99999)}' if random.random()>0.5 else '',
    })

with open('data/06_Invoice_Dump.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=datasets['06_Invoice_Dump'])
    w.writeheader(); w.writerows(rows)
print(f'06_Invoice_Dump: {len(rows)} rows')

# =============================================
# 07 — PAYMENT DUMP
# =============================================
rows = []
for i in range(1, 31):
    v = pick(VENDORS)
    rows.append({
        'payment_doc': f'29000{random.randint(10000,99999)}',
        'payment_year': '2022',
        'vendor': v[0],
        'document_type': pick(['ZP','KZ']),
        'posting_date': rdate('2022-08-01','2023-03-31'),
        'clearing_date': rdate('2022-08-01','2023-03-31'),
        'payment_method': pick(['T','C','S']),
        'amount_local_ccy': round(random.uniform(5000,1000000),2),
        'discount_taken': round(random.uniform(0,5000),2),
        'cleared_invoice': f'19000{random.randint(10000,99999)}',
        'bank_reference': f'HDFC2022{random.randint(10000000,99999999)}' if random.random()>0.3 else '',
        'house_bank': pick(['HDFC1','SBII1','ICIC1','AXIS1']),
    })

with open('data/07_Payment_Dump.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=datasets['07_Payment_Dump'])
    w.writeheader(); w.writerows(rows)
print(f'07_Payment_Dump: {len(rows)} rows')

# =============================================
# 08 — VENDOR MASTER
# =============================================
rows = []
for idx, (v_code, v_name) in enumerate(VENDORS):
    d = VENDOR_DETAILS[idx]
    rows.append({
        'vendor': v_code,
        'vendor_name': v_name,
        'country': d[0], 'city': d[1], 'postal_code': d[2], 'region': d[3],
        'account_group': d[4], 'tax_number_pan': d[5], 'tax_number_gstin': d[6],
        'central_purchasing_block': pick(['','X']) if random.random()>0.85 else '',
        'central_posting_block': pick(['','X']) if random.random()>0.9 else '',
        'deletion_flag_central': pick(['','X']) if random.random()>0.95 else '',
        'company_code': '1001',
        'payment_terms': pick(['N030','N045','N060','I001']),
        'payment_block': pick(['','*']) if random.random()>0.9 else '',
        'posting_block_cc': pick(['','X']) if random.random()>0.9 else '',
    })

with open('data/08_Vendor_Master.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=datasets['08_Vendor_Master'])
    w.writeheader(); w.writerows(rows)
print(f'08_Vendor_Master: {len(rows)} rows')

# =============================================
# 09 — CHANGE LOG
# =============================================
rows = []
object_classes = []
for _ in range(20):
    oc = pick(['BANF','EINKBELEG','KRED'])
    obj_id = (f'1000{random.randint(3478,9999)}' if oc=='BANF'
              else f'200000{random.randint(1000,9999)}' if oc=='EINKBELEG'
              else pick([v[0] for v in VENDORS]))
    table = {'BANF':'EBAN','EINKBELEG':pick(['EKKO','EKPO']),'KRED':pick(['LFA1','LFB1'])}[oc]
    tcode = {'BANF':'ME22N','EINKBELEG':'ME291N','KRED':'XK01'}[oc]
    field = pick({
        'BANF':['PREIS','MENGE','TXZ01','FRGKZ','LOEKZ'],
        'EINKBELEG':['NETWR','NETPR','MENGE','TXZ01','LOEKZ','FRGKZ','MATNR'],
        'KRED':['KTOKK','ZTERM','NAME1','ORT01'],
    }[oc])
    rows.append({
        'object_class': oc,
        'object_id': obj_id,
        'change_number': f'{random.randint(100000,999999):06d}',
        'username': pick(USERS),
        'change_date': rdate('2022-03-01','2022-12-31'),
        'change_time': rtime(),
        'tcode': tcode,
        'table_name': table,
        'field_name': field,
        'change_indicator': pick(['U','I','D']),
        'old_value': str(round(random.uniform(100,100000),2)),
        'new_value': str(round(random.uniform(100,100000),2)),
    })

with open('data/09_Change_Log.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=datasets['09_Change_Log'])
    w.writeheader(); w.writerows(rows)
print(f'09_Change_Log: {len(rows)} rows')

# =============================================
# SOURCE SHEETS — BID_Data, RFQ, Budget_Master
# =============================================
# BID DATA
rows = [
    {'rfq_id':'RFQ001','supplier_id':'732880','bid_id':'BID001','bid_version':'1','submitted_datetime':'2022-03-15 10:30:00','submission_status':'SUBMITTED','currency':'INR','total_bid_value':'4200000.00'},
    {'rfq_id':'RFQ001','supplier_id':'700100','bid_id':'BID002','bid_version':'1','submitted_datetime':'2022-03-15 11:00:00','submission_status':'SUBMITTED','currency':'INR','total_bid_value':'4500000.00'},
    {'rfq_id':'RFQ002','supplier_id':'700200','bid_id':'BID003','bid_version':'2','submitted_datetime':'2022-04-20 09:15:00','submission_status':'REVISED','currency':'INR','total_bid_value':'3200000.00'},
    {'rfq_id':'RFQ002','supplier_id':'700300','bid_id':'BID004','bid_version':'1','submitted_datetime':'2022-04-18 14:00:00','submission_status':'SUBMITTED','currency':'INR','total_bid_value':'3500000.00'},
    {'rfq_id':'RFQ003','supplier_id':'700400','bid_id':'BID005','bid_version':'1','submitted_datetime':'2022-05-10 16:45:00','submission_status':'WITHDRAWN','currency':'INR','total_bid_value':'2800000.00'},
    {'rfq_id':'RFQ003','supplier_id':'700500','bid_id':'BID006','bid_version':'1','submitted_datetime':'2022-05-11 08:30:00','submission_status':'SUBMITTED','currency':'INR','total_bid_value':'2650000.00'},
    {'rfq_id':'RFQ001','supplier_id':'700600','bid_id':'BID007','bid_version':'1','submitted_datetime':'2022-03-14 12:00:00','submission_status':'SUBMITTED','currency':'INR','total_bid_value':'4350000.00'},
]
with open('data/BID_Data.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)
print(f'BID_Data: {len(rows)} rows')

# RFQ
rfq_fields = ['rfq_id','rfq_title','sourcing_team','status','published_date','closing_date','currency']
rows = [
    {'rfq_id':'RFQ001','rfq_title':'Construction Materials for Bengaluru Plant','sourcing_team':'INDIRECT','status':'CLOSED','published_date':'2022-03-01','closing_date':'2022-03-31','currency':'INR'},
    {'rfq_id':'RFQ002','rfq_title':'IT Hardware Procurement FY22-23','sourcing_team':'IT','status':'CLOSED','published_date':'2022-04-01','closing_date':'2022-04-30','currency':'INR'},
    {'rfq_id':'RFQ003','rfq_title':'Logistics & Transport Services PAN India','sourcing_team':'LOGISTICS','status':'ACTIVE','published_date':'2022-05-01','closing_date':'2022-05-31','currency':'INR'},
    {'rfq_id':'RFQ004','rfq_title':'Office Supplies Annual Contract','sourcing_team':'ADMIN','status':'DRAFT','published_date':'2022-06-01','closing_date':'2022-06-30','currency':'INR'},
    {'rfq_id':'RFQ005','rfq_title':'Chemical Raw Materials Q3 2022','sourcing_team':'DIRECT','status':'ACTIVE','published_date':'2022-05-15','closing_date':'2022-06-15','currency':'INR'},
]
with open('data/RFQ.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=rfq_fields)
    w.writeheader(); w.writerows(rows)
print(f'RFQ: {len(rows)} rows')

# Budget Master
budget_fields = ['budget_id','fiscal_year','status','owner_id','currency',
                 'dimension_key_id','business_unit_id','cost_center_id','project_id','category_id',
                 'version_number','budget_amount','check_stage','control_type','tolerance_percent']
rows = [
    {'budget_id':'BUD001','fiscal_year':'2022','status':'APPROVED','owner_id':'RKUMAR','currency':'INR','dimension_key_id':'DIM001','business_unit_id':'BU01','cost_center_id':'CC1001','project_id':'P001','category_id':'CAPEX','version_number':'V1','budget_amount':'50000000.00','check_stage':'PO_CREATION','control_type':'HARD','tolerance_percent':'5'},
    {'budget_id':'BUD002','fiscal_year':'2022','status':'APPROVED','owner_id':'SVERMA','currency':'INR','dimension_key_id':'DIM002','business_unit_id':'BU02','cost_center_id':'CC1002','project_id':'P002','category_id':'OPEX','version_number':'V1','budget_amount':'25000000.00','check_stage':'PO_CREATION','control_type':'SOFT','tolerance_percent':'10'},
    {'budget_id':'BUD003','fiscal_year':'2022','status':'DRAFT','owner_id':'AGUPTA','currency':'INR','dimension_key_id':'DIM003','business_unit_id':'BU01','cost_center_id':'CC1003','project_id':'P003','category_id':'CAPEX','version_number':'V2','budget_amount':'35000000.00','check_stage':'PR_CREATION','control_type':'HARD','tolerance_percent':'3'},
    {'budget_id':'BUD004','fiscal_year':'2022','status':'APPROVED','owner_id':'PDESAI','currency':'INR','dimension_key_id':'DIM004','business_unit_id':'BU03','cost_center_id':'CC1004','project_id':'P004','category_id':'OPEX','version_number':'V1','budget_amount':'15000000.00','check_stage':'INVOICE','control_type':'SOFT','tolerance_percent':'10'},
    {'budget_id':'BUD005','fiscal_year':'2023','status':'PENDING','owner_id':'RKUMAR','currency':'INR','dimension_key_id':'DIM005','business_unit_id':'BU01','cost_center_id':'CC1001','project_id':'P005','category_id':'CAPEX','version_number':'V1','budget_amount':'60000000.00','check_stage':'PO_CREATION','control_type':'HARD','tolerance_percent':'5'},
]
with open('data/Budget_Master.csv','w',newline='') as f:
    w = csv.DictWriter(f, fieldnames=budget_fields)
    w.writeheader(); w.writerows(rows)
print(f'Budget_Master: {len(rows)} rows')

print('\nAll dummy data files created successfully in data/ folder.')
