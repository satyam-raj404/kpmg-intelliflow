# Financial Dashboard — KPI SQL Queries

SAP source tables: `06_Invoice_Dump` → `invoice_dump`, `07_Payment_Dump` → `payment_dump`,  
`05_PO_Invoice_Dump` → `po_invoice_dump`, `04_GRN_Dump` → `grn_dump`, `02_PO_Dump` → `po_dump`

**Key join:** `payment_dump.cleared_invoice = invoice_dump.invoice_doc`  
**Document types:** `RE` = PO-linked invoice · `KR` = Non-PO invoice · `RN` = Cancellation/reversal  
**FY start (Indian):** April 1 of current/prior year based on `ref_date`

---

## KPI 1 — Total Spend (YTD)

**Business question:** What is the total procurement spend this fiscal year?  
**Target:** Within budget  **Unit:** INR

```sql
-- Includes: RE (PO invoices) + KR (Non-PO invoices) + RN (Cancellations, stored as negative)
-- No debit_credit_ind in invoice_dump — RN amounts are stored as negative values naturally
-- Do NOT add amount > 0 filter — credit memos within RE/KR must be included

SELECT SUM(CAST(amount_local_ccy AS REAL)) AS total_spend_ytd
FROM invoice_dump
WHERE document_type IN ('RE', 'KR', 'RN')
  AND posting_date >= :fy_start;
-- RE: PO-linked invoices (BSIK/BSAK doc type RE)
-- KR: Non-PO vendor invoices (doc type KR)
-- RN: Reversal/cancellation docs — already stored as negative amounts → naturally reduces total
```

---

## KPI 2 — Invoice Cancellation Rate (%)

**Business question:** What percentage of invoices were cancelled?  
**Target:** —  **Unit:** %

```sql
SELECT
    CAST(COUNT(CASE WHEN document_type = 'RN' THEN 1 END) AS REAL) * 100.0
    / NULLIF(COUNT(CASE WHEN document_type IN ('RE', 'KR', 'RN') THEN 1 END), 0)
    AS cancellation_rate_pct
FROM invoice_dump;
-- Numerator:   document_type = 'RN' only (pure cancellations)
-- Denominator: all invoice transactions (RE + KR + RN)
-- Do NOT use amount < 0 as proxy for cancellation — unreliable
```

---

## KPI 3 — Three-Way Match Success Rate

**Business question:** What % of PO lines have GRN quantity matching PO quantity?  
**Target:** > 95%  **Unit:** %

```sql
-- PO qty == net GRN qty (receipts - returns, within ±5% tolerance)
-- grn_quantity in pr_po_grn_invoice already nets: S (receipts) - H (returns)
-- Debit/credit indicator already accounted for in fact table build

SELECT
    COUNT(CASE
        WHEN ABS(COALESCE(f.grn_quantity, 0) - CAST(f.po_quantity AS REAL))
             / NULLIF(ABS(CAST(f.po_quantity AS REAL)), 0) <= 0.05
        THEN 1
    END) * 100.0
    / NULLIF(COUNT(CASE
        WHEN f.po_quantity IS NOT NULL AND f.po_quantity > 0
        THEN 1
    END), 0) AS three_way_match_rate_pct
FROM pr_po_grn_invoice f
WHERE f.purchasing_document IS NOT NULL
  AND f.po_quantity   IS NOT NULL
  AND f.grn_quantity  IS NOT NULL;
-- po_quantity    = EKPO-MENGE  (ordered quantity)
-- grn_quantity   = net of EKBE debit_credit_ind S (received) minus H (returned)
-- 5% tolerance accounts for rounding and partial deliveries
```

---

## KPI 4 — Invoice Processing Cycle Time

**Business question:** How long does it take to process an invoice from receipt to payment clearing?  
**Target:** ≤ 5 days  **Unit:** Days

```sql
-- Spec: AVG(DATEDIFF(Payment_Dump.clearing_date, Invoice_Dump.vendor_invoice_date))
-- Join: payment_dump.cleared_invoice = invoice_dump.invoice_doc
-- WARNING: invoice_dump.clearing_doc ≠ payment_dump.payment_doc (different number ranges)
--          Always join via cleared_invoice → invoice_doc

SELECT AVG(
    julianday(p.clearing_date) - julianday(i.vendor_invoice_date)
) AS avg_invoice_processing_days
FROM invoice_dump i
JOIN payment_dump p ON p.cleared_invoice = i.invoice_doc
WHERE i.vendor_invoice_date IS NOT NULL
  AND p.clearing_date IS NOT NULL;
-- vendor_invoice_date = BSIK-BLDAT (vendor's own invoice date)
-- clearing_date       = BSAK-AUGDT (date the payment cleared the invoice)
```

---

## KPI 5 — Payment On-Time Rate

**Business question:** What % of invoices were paid on or before their due date?  
**Target:** > 90%  **Unit:** %

```sql
-- Numerator:   cleared invoices where payment.posting_date ≤ invoice.due_date
-- Denominator: all cleared invoices (clearing_doc IS NOT NULL)

SELECT
    COUNT(CASE WHEN p.posting_date <= i.due_date THEN 1 END) * 100.0
    / NULLIF(COUNT(*), 0) AS on_time_payment_rate_pct
FROM payment_dump p
JOIN invoice_dump i ON p.cleared_invoice = i.invoice_doc
WHERE i.due_date IS NOT NULL;
-- due_date    = BSIK-ZFBDT + payment terms days (pre-calculated in data)
-- posting_date = BSAK-BUDAT (actual payment posting date in SAP)
```

---

## KPI 6 — Days Payable Outstanding (DPO)

**Business question:** On average, how many days do we take to pay vendors after invoice posting?  
**Target:** Match payment terms (30/45/60 days)  **Unit:** Days

```sql
-- Spec: AVG(DATEDIFF(Payment_Dump.posting_date, Invoice_Dump.posting_date))
--       for invoices linked to payments via cleared_invoice → invoice_doc

SELECT AVG(
    julianday(p.posting_date) - julianday(i.posting_date)
) AS dpo_days
FROM payment_dump p
JOIN invoice_dump i ON p.cleared_invoice = i.invoice_doc
WHERE i.posting_date IS NOT NULL;
-- invoice posting_date = BSIK-BUDAT (date invoice was posted in SAP)
-- payment posting_date = BSAK-BUDAT (date payment was posted in SAP)
-- Note: differs from Invoice Processing Time (F4) which uses vendor_invoice_date and clearing_date
```

---

## KPI 7 — Open Invoice Aging (Total ₹)

**Business question:** How much do we owe vendors in unpaid invoices, and how old are they?  
**Target:** < ₹5 Cr in 90+ day bucket  **Unit:** INR (bucketed)

```sql
-- Total open invoice value
SELECT SUM(CAST(amount_local_ccy AS REAL)) AS open_invoice_value
FROM invoice_dump
WHERE (clearing_doc IS NULL OR clearing_doc = '')
  AND document_type IN ('RE', 'KR')
  AND CAST(amount_local_ccy AS REAL) > 0;

-- Aging buckets (use :ref_date = MAX(po_dump.document_date) for historical data)
SELECT
    SUM(CASE WHEN julianday(:ref_date) - julianday(posting_date) BETWEEN  0 AND 30
             THEN CAST(amount_local_ccy AS REAL) ELSE 0 END) AS bucket_0_30d,
    SUM(CASE WHEN julianday(:ref_date) - julianday(posting_date) BETWEEN 31 AND 60
             THEN CAST(amount_local_ccy AS REAL) ELSE 0 END) AS bucket_31_60d,
    SUM(CASE WHEN julianday(:ref_date) - julianday(posting_date) BETWEEN 61 AND 90
             THEN CAST(amount_local_ccy AS REAL) ELSE 0 END) AS bucket_61_90d,
    SUM(CASE WHEN julianday(:ref_date) - julianday(posting_date) > 90
             THEN CAST(amount_local_ccy AS REAL) ELSE 0 END) AS bucket_90plus_d
FROM invoice_dump
WHERE (clearing_doc IS NULL OR clearing_doc = '')
  AND document_type IN ('RE', 'KR')
  AND CAST(amount_local_ccy AS REAL) > 0;
-- posting_date = BSIK-BUDAT (date the unpaid invoice was posted)
-- Age measured from posting_date, not vendor_invoice_date
```

---

## KPI 8 — Early / Delayed Payment Count

**Business question:** How many invoices were paid early vs late?  
**Target:** > 80% paid early  **Unit:** Count + %

```sql
-- Early: paid on or before due date
SELECT COUNT(*) AS early_payment_count
FROM payment_dump p
JOIN invoice_dump i ON p.cleared_invoice = i.invoice_doc
WHERE i.due_date IS NOT NULL
  AND p.posting_date <= i.due_date;

-- Late: paid after due date
SELECT COUNT(*) AS late_payment_count
FROM payment_dump p
JOIN invoice_dump i ON p.cleared_invoice = i.invoice_doc
WHERE i.due_date IS NOT NULL
  AND p.posting_date > i.due_date;

-- Combined with rate
SELECT
    COUNT(CASE WHEN p.posting_date <= i.due_date THEN 1 END) AS early_count,
    COUNT(CASE WHEN p.posting_date  > i.due_date THEN 1 END) AS late_count,
    COUNT(*) AS total_count,
    CAST(COUNT(CASE WHEN p.posting_date <= i.due_date THEN 1 END) AS REAL)
        * 100.0 / NULLIF(COUNT(*), 0)                         AS early_rate_pct
FROM payment_dump p
JOIN invoice_dump i ON p.cleared_invoice = i.invoice_doc
WHERE i.due_date IS NOT NULL;
-- posting_date = BSAK-BUDAT (actual payment date)
-- due_date     = pre-calculated from BSIK-ZFBDT + payment terms
```

---

## Parameter Reference

| Parameter | Source | Default | Notes |
|-----------|--------|---------|-------|
| `:fy_start` | April 1 of current/prior year based on `ref_date` | `'2022-04-01'` | Indian FY |
| `:ref_date` | `MAX(po_dump.document_date)` | Latest data date | Prevents zero KPIs on historical data |
| `clearing_doc` | `invoice_dump.clearing_doc` | NULL if unpaid | Links cleared invoices to payment docs |
| `cleared_invoice` | `payment_dump.cleared_invoice` | — | FK to `invoice_dump.invoice_doc` |

## Critical Join Warning

```
❌ WRONG:  invoice_dump i JOIN payment_dump p ON i.clearing_doc = p.payment_doc
           (different numbering ranges — produces 0 rows)

✅ CORRECT: invoice_dump i JOIN payment_dump p ON p.cleared_invoice = i.invoice_doc
            (payment_dump.cleared_invoice references the invoice document cleared by the payment)
```

## SAP Field Mapping

| Column (DB) | SAP Field | Table | Meaning |
|-------------|-----------|-------|---------|
| `invoice_doc` | BELNR | BSIK/BSAK | Invoice document number |
| `document_type` | BLART | BSIK/BSAK | `RE`=PO invoice, `KR`=Non-PO, `RN`=Reversal |
| `vendor_invoice_date` | BLDAT | BSIK/BSAK | Vendor's document date |
| `posting_date` | BUDAT | BSIK/BSAK | SAP posting date |
| `due_date` | Calculated from ZFBDT + ZBD3T | BSIK | Payment due date |
| `amount_local_ccy` | DMBTR | BSIK/BSAK | Amount in INR (RN stored as negative) |
| `clearing_doc` | AUGBL | BSAK | Payment document that cleared the invoice |
| `po_reference` | EBELN | BSIK/BSAK | PO number for PO-linked invoices |
| `payment_doc` | BELNR | BSAK (KZ/ZP) | Payment document number |
| `clearing_date` | AUGDT | BSAK | Date payment cleared the invoice |
| `cleared_invoice` | REBZG | BSAK | Invoice document cleared by this payment |
| `payment_method` | ZLSCH | BSAK | `T`=Transfer, `C`=Cheque |
