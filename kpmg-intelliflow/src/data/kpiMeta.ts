export interface KpiMeta {
  title: string;
  description: string;
  formula: string;
  sql: string;
}

export const KPI_META: Record<string, KpiMeta> = {

  // ── PROCUREMENT ────────────────────────────────────────────────────────────

  TOTAL_PO_VALUE_MTD: {
    title: "Total PO Value (MTD)",
    description:
      "Sum of net order value for all active PO lines created in the current month. Uses COALESCE(created_on, document_date) so POs without ERDAT fall back to document_date.",
    formula: "SUM(net_order_value) WHERE deletion ∉ {L,X} AND COALESCE(created_on, document_date) ≥ month start",
    sql: `SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL
       OR deletion_indicator NOT IN ('L','X'))
  AND COALESCE(NULLIF(created_on,''), document_date) >= {MTD}`,
  },

  ACTIVE_PO_COUNT: {
    title: "Active PO Count",
    description:
      "Distinct PO document numbers that are not deleted and not yet delivery-completed. Represents open procurement commitments across all line items.",
    formula: "COUNT(DISTINCT purchasing_document) WHERE delivery_completed blank AND deletion ∉ {L,X}",
    sql: `SELECT COUNT(DISTINCT purchasing_document)
FROM po_dump
WHERE (deletion_indicator IS NULL
       OR deletion_indicator NOT IN ('L','X'))
  AND (delivery_completed IS NULL OR delivery_completed = '')`,
  },

  HIGH_VALUE_PO_COUNT: {
    title: "High-Value PO Count",
    description:
      "Number of distinct POs whose net order value exceeds the configurable high-value threshold (default ₹1 Cr, adjustable on the Leadership dashboard). Useful for executive attention and approval tracking.",
    formula: "COUNT(DISTINCT po) WHERE net_order_value > HIGH_VALUE_THRESHOLD AND deletion ∉ {L,X}",
    sql: `SELECT COUNT(DISTINCT purchasing_document)
FROM po_dump
WHERE (deletion_indicator IS NULL
       OR deletion_indicator NOT IN ('L','X'))
  AND CAST(net_order_value AS REAL) > {high_value_threshold}`,
  },

  PR_TO_PO_DAYS: {
    title: "Avg PR-to-PO Conversion Time",
    description:
      "Average days from Purchase Requisition creation to linked PO creation. Read from the pr_to_po_days pre-joined column in the pr_po_grn_invoice fact table. Negative/null values and rows without both PR and PO are excluded.",
    formula: "AVG(pr_to_po_days) FROM pr_po_grn_invoice WHERE pr_to_po_days ≥ 0 AND both PR and PO exist",
    sql: `SELECT AVG(CAST(pr_to_po_days AS REAL))
FROM pr_po_grn_invoice
WHERE pr_to_po_days      IS NOT NULL
  AND pr_to_po_days      >= 0
  AND purchase_requisition IS NOT NULL
  AND purchasing_document  IS NOT NULL`,
  },

  PO_APPROVAL_CYCLE: {
    title: "PO Approval Cycle Time",
    description:
      "Average days from PO creation (ERDAT) to final release recorded in the change log (FRGZU field set to 'X'). Covers single and multi-level release (release_indicator LIKE 'X%').",
    formula: "AVG(change_log.change_date − po.created_on) WHERE field=FRGZU AND new_value LIKE 'X%'",
    sql: `SELECT AVG((cl.change_date::DATE - po.created_on::DATE)::FLOAT)
FROM po_dump po
JOIN change_log cl
  ON cl.object_id        = po.purchasing_document
 AND cl.object_class     = 'EINKBELEG'
 AND cl.field_name       = 'FRGZU'
 AND cl.change_indicator IN ('E', 'U')
 AND cl.new_value        LIKE 'X%'
WHERE po.release_indicator LIKE 'X%'
  AND (po.deletion_indicator IS NULL
       OR po.deletion_indicator NOT IN ('L','X'))
  AND po.created_on IS NOT NULL AND po.created_on != ''`,
  },

  PO_DELETION_MTD: {
    title: "PO Deleted Line Items (MTD)",
    description:
      "Count of distinct PO line items (document + item) with deletion_indicator = 'L' in the current month. High MTD deletion rates may indicate poor demand planning, data errors, or misuse of the deletion flag.",
    formula: "COUNT(DISTINCT po_doc|item) WHERE deletion_indicator = 'L' AND date ≥ month start",
    sql: `SELECT COUNT(DISTINCT purchasing_document || '|' || item)
FROM po_dump
WHERE deletion_indicator = 'L'
  AND COALESCE(NULLIF(created_on,''), document_date) >= {MTD}`,
  },

  PO_AMENDMENT_RATE: {
    title: "PO Amendment Rate (%)",
    description:
      "Percentage of active PO line items that have had a material, price, quantity, or value change in the change log after creation. High rates indicate unstable demand or supplier negotiations.",
    formula: "( COUNT(lines with MATNR/NETPR/NETWR/MENGE change) / COUNT(all active lines) ) × 100",
    sql: `-- Numerator: amended line items
SELECT COUNT(DISTINCT po.purchasing_document || '|' || po.item)
FROM po_dump po
JOIN change_log cl
  ON cl.object_id        = po.purchasing_document
 AND cl.object_class     = 'EINKBELEG'
 AND cl.change_indicator IN ('E', 'U')
 AND cl.field_name       IN ('MATNR','NETPR','NETWR','MENGE')
WHERE (po.deletion_indicator IS NULL
       OR po.deletion_indicator NOT IN ('L','X'))

-- Denominator: total active line items
-- SELECT COUNT(DISTINCT purchasing_document || '|' || item)
-- FROM po_dump WHERE deletion_indicator NOT IN ('L','X')

-- Python: round(amended / total * 100, 2)`,
  },

  OPEN_PR_AGING: {
    title: "Open PR Lines (>7 Days, No PO)",
    description:
      "Count of fully-released PR line items waiting more than 7 days without a linked PO. Uses the latest document date in po_dump as reference date (not today) so historical datasets work correctly.",
    formula: "COUNT(PR lines) WHERE release_status LIKE 'X%' AND (ref_date − release_date) > 7 AND NOT EXISTS(linked PO)",
    sql: `SELECT COUNT(DISTINCT
       pr.purchase_requisition || '|' || pr.item_of_requisition)
FROM pr_dump pr
WHERE pr.release_status LIKE 'X%'
  AND (pr.deletion_indicator IS NULL OR pr.deletion_indicator = '')
  AND pr.release_date IS NOT NULL
  AND ('{ref_date}'::DATE - pr.release_date::DATE) > 7
  AND NOT EXISTS (
      SELECT 1 FROM po_dump po
      WHERE po.purchase_requisition = pr.purchase_requisition
        AND po.item_of_requisition  = pr.item_of_requisition
  )`,
  },

  // ── FINANCIAL ─────────────────────────────────────────────────────────────

  TOTAL_PAYMENTS_YTD: {
    title: "Total Payments (YTD)",
    description:
      "Sum of all amounts in payment_dump from the start of the current Indian financial year (April 1). No D/C sign adjustment — all rows represent outgoing payments.",
    formula: "SUM(amount_local_ccy) FROM payment_dump WHERE posting_date ≥ FY start",
    sql: `SELECT SUM(CAST(amount_local_ccy AS REAL))
FROM payment_dump
WHERE posting_date >= {FY}`,
  },

  PAYMENT_TO_PO_RATIO: {
    title: "Payment-to-PO Ratio (%)",
    description:
      "Total YTD payments as a percentage of total YTD PO value. Values > 100% indicate payments exceed PO commitments (possible advance payments or prior-year clearances). PO denominator uses document_date.",
    formula: "( SUM(payment_dump.amount_local_ccy YTD) / SUM(po_dump.net_order_value YTD) ) × 100",
    sql: `-- Step 1: Total Payments YTD (= TOTAL_PAYMENTS_YTD)
SELECT SUM(CAST(amount_local_ccy AS REAL))
FROM payment_dump WHERE posting_date >= {FY}

-- Step 2: Total PO Value YTD (denominator)
SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL
       OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= {FY}

-- Python: round(payments / po_value * 100, 2)`,
  },

  THREE_WAY_MATCH_RATE: {
    title: "3-Way Match Success Rate (%)",
    description:
      "PO lines (with invoice) where all three legs match within 5% tolerance. MATERIAL items: PO qty ≈ GRN qty ≈ Invoice qty. SERVICE items: PO amt ≈ GRN amt ≈ Invoice amt. Denominator = PO lines joined to at least one invoice.",
    formula: "COUNT(matched lines) / COUNT(PO lines with invoice) × 100 — MATERIAL and SERVICE checked separately",
    sql: `WITH po AS (
  SELECT company_code, purchasing_document, item,
         CAST(order_quantity  AS REAL) AS po_qty,
         CAST(net_order_value AS REAL) AS po_amt,
         CASE WHEN material_type IS NOT NULL AND material_type != ''
              THEN 'MATERIAL' ELSE 'SERVICE' END AS item_type
  FROM po_dump
  WHERE (deletion_indicator IS NULL
         OR deletion_indicator NOT IN ('L','X'))
),
grn AS (
  SELECT purchasing_document, item,
         SUM(CAST(quantity AS REAL)
           * CASE WHEN debit_credit_ind='S' THEN 1 ELSE -1 END) AS grn_qty,
         SUM(CAST(amount_local_ccy AS REAL)
           * CASE WHEN debit_credit_ind='S' THEN 1 ELSE -1 END) AS grn_amt
  FROM grn_dump GROUP BY purchasing_document, item
),
inv AS (
  SELECT purchasing_document, item,
         SUM(CAST(quantity AS REAL)
           * CASE WHEN debit_credit_ind='S' THEN 1 ELSE -1 END) AS inv_qty,
         SUM(CAST(amount_local_ccy AS REAL)
           * CASE WHEN debit_credit_ind='S' THEN 1 ELSE -1 END) AS inv_amt
  FROM po_invoice_dump GROUP BY purchasing_document, item
)
SELECT COUNT(CASE
  WHEN item_type='MATERIAL'
   AND ABS(grn_qty-po_qty)/NULLIF(ABS(po_qty),0)   <= 0.05
   AND ABS(inv_qty-po_qty)/NULLIF(ABS(po_qty),0)   <= 0.05
   AND ABS(inv_qty-grn_qty)/NULLIF(ABS(grn_qty),0) <= 0.05 THEN 1
  WHEN item_type='SERVICE'
   AND ABS(grn_amt-po_amt)/NULLIF(ABS(po_amt),0)   <= 0.05
   AND ABS(inv_amt-po_amt)/NULLIF(ABS(po_amt),0)   <= 0.05
   AND ABS(inv_amt-grn_amt)/NULLIF(ABS(grn_amt),0) <= 0.05 THEN 1
END) * 100.0 / NULLIF(COUNT(*), 0)
FROM po
JOIN      inv USING (purchasing_document, item)
LEFT JOIN grn USING (purchasing_document, item)`,
  },

  INVOICE_PROCESSING_DAYS: {
    title: "Invoice Processing Days",
    description:
      "Average days from vendor invoice date to payment clearing date. Joins invoice_dump (vendor_invoice_date) with payment_dump (clearing_date) via cleared_invoice. Cancelled invoices and reversed payments (net-zero payment docs) both excluded.",
    formula: "AVG(payment.clearing_date − invoice.vendor_invoice_date) with cancellations removed",
    sql: `WITH cancelled_inv AS (
  SELECT DISTINCT reverse_invoice AS doc FROM invoice_dump
  WHERE reverse_invoice IS NOT NULL AND reverse_invoice != ''
),
valid_inv AS (
  SELECT company_code, vendor, invoice_doc, vendor_invoice_date
  FROM invoice_dump
  WHERE vendor_invoice_date IS NOT NULL
    AND (reverse_invoice IS NULL OR reverse_invoice = '')
    AND invoice_doc NOT IN (SELECT doc FROM cancelled_inv)
),
noncancelled_pay AS (
  SELECT company_code, vendor, payment_doc
  FROM payment_dump
  GROUP BY company_code, vendor, payment_doc
  HAVING ABS(SUM(CAST(amount_local_ccy AS REAL)
    * CASE WHEN debit_credit_ind='S' THEN 1 ELSE -1 END)) > 0.005
),
valid_pay AS (
  SELECT pd.company_code, pd.vendor,
         pd.clearing_date, pd.cleared_invoice
  FROM payment_dump pd
  JOIN noncancelled_pay nc
    ON nc.payment_doc=pd.payment_doc AND nc.company_code=pd.company_code
   AND nc.vendor=pd.vendor
  WHERE pd.debit_credit_ind = 'S'
)
SELECT AVG((vp.clearing_date::DATE
          - vi.vendor_invoice_date::DATE)::FLOAT)
FROM valid_inv vi
JOIN valid_pay vp
  ON vp.cleared_invoice=vi.invoice_doc
 AND vp.company_code=vi.company_code AND vp.vendor=vi.vendor
WHERE vp.clearing_date IS NOT NULL`,
  },

  ON_TIME_PAYMENT_RATE: {
    title: "On-Time Payment Rate (%)",
    description:
      "Percentage of cleared invoices where clearing_date exactly equals the due_date. NOTE: exact-match only — early payments (clearing_date < due_date) and late payments are both excluded from the numerator. Same payment/invoice CTE join used for all payment timing KPIs.",
    formula: "COUNT(clearing_date = due_date) / COUNT(all cleared with due_date) × 100",
    sql: `-- Uses same cancelled_inv / valid_inv / valid_pay CTEs
-- as INVOICE_PROCESSING_DAYS (replace vendor_invoice_date with due_date)

SELECT COUNT(CASE WHEN vp.clearing_date = vi.due_date THEN 1 END)
       * 100.0 / NULLIF(COUNT(*), 0)
FROM valid_inv vi   -- due_date IS NOT NULL AND NOT cancelled
JOIN valid_pay vp   -- non-reversed payment docs, debit_credit_ind='S'
  ON vp.cleared_invoice=vi.invoice_doc
 AND vp.company_code=vi.company_code AND vp.vendor=vi.vendor
WHERE vp.clearing_date IS NOT NULL`,
  },

  OPEN_INVOICE_VALUE: {
    title: "Open Invoice Aging",
    description:
      "Total outstanding AP value for invoices not yet cleared (clearing_doc IS NULL), excluding cancelled invoices. value_numeric = total open amount; value_text = JSON breakdown by aging bucket (not_yet_due / 0-10d / 10-20d / 20-30d / 30-60d / 60-90d / 90+d).",
    formula: "SUM(amount × dc_sign) WHERE clearing_doc IS NULL AND doc_type IN {RE,KR} AND not cancelled",
    sql: `WITH open_inv AS (
  SELECT CAST(amount_local_ccy AS REAL)
         * CASE WHEN debit_credit_ind='S' THEN 1 ELSE -1 END AS signed_amt,
         (CURRENT_DATE - due_date::DATE) AS days_overdue
  FROM invoice_dump
  WHERE (clearing_doc IS NULL OR clearing_doc = '')
    AND document_type IN ('RE','KR')
    AND due_date IS NOT NULL AND due_date != ''
    AND (reverse_invoice IS NULL OR reverse_invoice = '')
    AND invoice_doc NOT IN (
      SELECT DISTINCT reverse_invoice FROM invoice_dump
      WHERE reverse_invoice IS NOT NULL AND reverse_invoice != ''
    )
)
SELECT
  SUM(CASE WHEN days_overdue <   0             THEN signed_amt ELSE 0 END) AS not_yet_due,
  SUM(CASE WHEN days_overdue BETWEEN  0 AND  9 THEN signed_amt ELSE 0 END) AS "0-10d",
  SUM(CASE WHEN days_overdue BETWEEN 10 AND 19 THEN signed_amt ELSE 0 END) AS "10-20d",
  SUM(CASE WHEN days_overdue BETWEEN 20 AND 29 THEN signed_amt ELSE 0 END) AS "20-30d",
  SUM(CASE WHEN days_overdue BETWEEN 30 AND 59 THEN signed_amt ELSE 0 END) AS "30-60d",
  SUM(CASE WHEN days_overdue BETWEEN 60 AND 89 THEN signed_amt ELSE 0 END) AS "60-90d",
  SUM(CASE WHEN days_overdue >= 90             THEN signed_amt ELSE 0 END) AS "90+d",
  SUM(signed_amt)                                                           AS total_open
FROM open_inv`,
  },

  APPROVED_PR_COUNT: {
    title: "Approved PRs (YTD)",
    description:
      "Distinct PR line items (purchase_requisition + item) fully released in the current FY. release_status must be in the set {X, XX, XXX, XXXX, XXXXX} — covers up to 5-level approval workflows. Deleted lines excluded.",
    formula: "COUNT(DISTINCT pr_line) WHERE release_status IN {X..XXXXX} AND release_date ≥ FY AND not deleted",
    sql: `SELECT COUNT(DISTINCT
       purchase_requisition || '|' || item_of_requisition)
FROM pr_dump
WHERE release_status IN ('X','XX','XXX','XXXX','XXXXX')
  AND (deletion_indicator IS NULL OR deletion_indicator = '')
  AND release_date >= {FY}`,
  },

  EARLY_PAYMENT_COUNT: {
    title: "Early Payments",
    description:
      "Count of cleared invoices where payment clearing_date is before the due_date (day_diff < 0). Computed in the same single query as On-Time and Late counts using the same payment/invoice CTEs.",
    formula: "COUNT(clearing_date < due_date) from payment_dump ⨝ invoice_dump (cancelled excluded)",
    sql: `-- From the F8 combined query (same CTEs as ON_TIME_PAYMENT_RATE):
SELECT
  COUNT(CASE WHEN day_diff < 0 THEN 1 END) AS early,
  COUNT(CASE WHEN day_diff = 0 THEN 1 END) AS on_time,
  COUNT(CASE WHEN day_diff > 0 THEN 1 END) AS late,
  AVG(CASE WHEN day_diff < 0 THEN ABS(day_diff) END) AS avg_days_early,
  AVG(CASE WHEN day_diff > 0 THEN day_diff END)       AS avg_days_late,
  COUNT(*) AS total
FROM (
  SELECT (vp.clearing_date::DATE - vi.due_date::DATE) AS day_diff
  FROM valid_inv vi
  JOIN valid_pay vp
    ON vp.cleared_invoice=vi.invoice_doc
   AND vp.company_code=vi.company_code AND vp.vendor=vi.vendor
  WHERE vp.clearing_date IS NOT NULL
) joined`,
  },

  ON_TIME_PAYMENT_COUNT: {
    title: "On-Time Payments",
    description:
      "Count of cleared invoices where clearing_date exactly equals the due_date (day_diff = 0). Part of the single F8 query that returns all three timing buckets at once.",
    formula: "COUNT(clearing_date = due_date) — see EARLY_PAYMENT_COUNT for full query",
    sql: `-- Column from the same F8 combined query as EARLY_PAYMENT_COUNT:
COUNT(CASE WHEN day_diff = 0 THEN 1 END) AS on_time`,
  },

  LATE_PAYMENT_COUNT: {
    title: "Late Payments",
    description:
      "Count of cleared invoices where payment clearing_date is after the due_date (day_diff > 0). Part of the single F8 query.",
    formula: "COUNT(clearing_date > due_date) — see EARLY_PAYMENT_COUNT for full query",
    sql: `-- Column from the same F8 combined query as EARLY_PAYMENT_COUNT:
COUNT(CASE WHEN day_diff > 0 THEN 1 END) AS late`,
  },

  // ── LEADERSHIP ────────────────────────────────────────────────────────────

  TOTAL_SPEND_YTD: {
    title: "Total Procurement Value (YTD)",
    description:
      "Total committed PO value from April 1 to current date. Uses created_on (ERDAT), not document_date. Excludes deletion_indicator = 'L' only; 'X' block lines are still included. Also returns released vs non-released PO count breakdown as JSON.",
    formula: "SUM(net_order_value) WHERE deletion ≠ 'L' AND FY_start ≤ created_on ≤ CURRENT_DATE",
    sql: `SELECT
  SUM(CAST(net_order_value AS REAL)),
  COUNT(DISTINCT purchasing_document),
  COUNT(DISTINCT CASE WHEN release_indicator LIKE 'X%'
                      THEN purchasing_document END),
  COUNT(DISTINCT CASE WHEN (release_indicator IS NULL
                            OR release_indicator = '')
                      THEN purchasing_document END)
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator <> 'L')
  AND created_on >= {FY}
  AND created_on <= CURRENT_DATE::TEXT`,
  },

  MAVERICK_BUY_RATE: {
    title: "Maverick PO Rate (%)",
    description:
      "Percentage of PO transactions flagged as maverick — created without a linked Purchase Requisition. The is_maverick column is pre-computed in the pr_po_grn_invoice ETL join step.",
    formula: "COUNT(is_maverick=1) / COUNT(*) × 100 FROM pr_po_grn_invoice WHERE purchasing_document IS NOT NULL",
    sql: `SELECT COUNT(CASE WHEN is_maverick = 1 THEN 1 END)
       * 100.0 / NULLIF(COUNT(*), 0)
FROM pr_po_grn_invoice
WHERE purchasing_document IS NOT NULL`,
  },

  E2E_CYCLE_TIME: {
    title: "End-to-End P2P Cycle Time (days)",
    description:
      "Average total days from PR creation through to final payment, pre-computed as total_cycle_days in the pr_po_grn_invoice fact table. Zero/null values excluded.",
    formula: "AVG(total_cycle_days) FROM pr_po_grn_invoice WHERE total_cycle_days > 0",
    sql: `SELECT AVG(CAST(total_cycle_days AS REAL))
FROM pr_po_grn_invoice
WHERE total_cycle_days IS NOT NULL
  AND total_cycle_days > 0`,
  },

  VENDOR_CONCENTRATION: {
    title: "Top-3 Vendor Spend Concentration (%)",
    description:
      "Percentage of total PO spend attributable to the top 3 vendors by spend. Only deletion 'L' excluded. Top-10 vendor list with individual spend shares stored as JSON for the accompanying chart.",
    formula: "SUM(spend of top-3 vendors) / SUM(all vendor spend) × 100",
    sql: `-- Step 1: Total vendor spend
SELECT SUM(CAST(net_order_value AS REAL)) AS total
FROM po_dump
WHERE deletion_indicator IS NULL OR deletion_indicator <> 'L'

-- Step 2: Top-10 vendors ranked by spend
SELECT po.vendor,
       COALESCE(MIN(vm.vendor_name), MIN(po.vendor_name), po.vendor) AS name,
       SUM(CAST(po.net_order_value AS REAL)) AS spend
FROM po_dump po
LEFT JOIN vendor_master vm ON po.vendor = vm.vendor
WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator <> 'L')
GROUP BY po.vendor
ORDER BY spend DESC LIMIT 10

-- Python: top3_spend / total * 100`,
  },

  NEGOTIATION_SAVINGS: {
    title: "Negotiation Savings YTD",
    description:
      "Sum of price savings where PR valuation_price > final PO net_price per unit, multiplied by ordered quantity. Measures documented price improvement during PR→PO negotiation. Source: pr_po_grn_invoice fact table.",
    formula: "SUM((pr_value − po_net_price) × po_quantity) WHERE pr_value > po_net_price",
    sql: `SELECT SUM(
  (CAST(pr_value     AS REAL) - CAST(po_net_price AS REAL))
  * CAST(po_quantity AS REAL)
)
FROM pr_po_grn_invoice
WHERE pr_value     IS NOT NULL
  AND po_net_price IS NOT NULL
  AND (CAST(pr_value AS REAL) - CAST(po_net_price AS REAL)) > 0`,
  },

  SUPPLY_RISK_SCORE: {
    title: "Supply Chain Risk Score",
    description:
      "Composite risk index (0–100): 40% Vendor Concentration %, 30% Maverick PO rate %, 30% Process Anomaly rate % (anomalous events / total events in process_mining_events table).",
    formula: "0.4 × vendor_conc_pct + 0.3 × maverick_pct + 0.3 × (anomalous_events / total_events × 100)",
    sql: `-- Components 1 & 2 reuse VENDOR_CONCENTRATION and MAVERICK_BUY_RATE queries.

-- Component 3: Anomaly rate from process_mining_events
SELECT COUNT(*) FROM process_mining_events
WHERE anomaly_count > 0   -- anom_count

SELECT COUNT(*) FROM process_mining_events  -- total_ev

-- Python:
-- anom_pct = (anom_count / total_ev) * 100
-- l6 = round(0.4 * conc_pct + 0.3 * mav_pct + 0.3 * anom_pct, 1)`,
  },

  SOD_CONFLICT_COUNT: {
    title: "SoD Conflict Count (All Scenarios)",
    description:
      "Total Segregation-of-Duties conflicts summed across 4 scenarios. S7a: same user created and released the PO. S7b: same user created PO and posted GRN. S7c: same user posted GRN and created invoice. S7d: same user created invoice and payment.",
    formula: "S7a + S7b + S7c + S7d",
    sql: `-- S7a: PO creator = PO releaser (change_log FRGZU = 'X')
SELECT COUNT(DISTINCT po.purchasing_document)
FROM po_dump po
JOIN change_log cl ON cl.object_id = po.purchasing_document
WHERE cl.object_class='EINKBELEG' AND cl.table_name='EKKO'
  AND cl.field_name='FRGZU' AND cl.change_indicator IN ('E','U')
  AND cl.new_value='X' AND cl.username = po.created_by
  AND (po.deletion_indicator IS NULL OR po.deletion_indicator = '')

-- S7b: PO creator = GRN poster (item-level)
SELECT COUNT(DISTINCT po.purchasing_document || '|' || po.item)
FROM po_dump po
JOIN grn_dump grn ON grn.purchasing_document=po.purchasing_document
  AND grn.item=po.item AND grn.debit_credit_ind='S'
WHERE po.created_by = grn.created_by
  AND (po.deletion_indicator IS NULL OR po.deletion_indicator = '')

-- S7c: GRN poster = invoice creator
SELECT COUNT(DISTINCT grn.material_document)
FROM grn_dump grn
JOIN po_invoice_dump inv ON inv.purchasing_document=grn.purchasing_document
  AND inv.item=grn.item AND inv.debit_credit_ind='S'
WHERE grn.debit_credit_ind='S' AND grn.created_by=inv.created_by

-- S7d: Invoice creator = payment poster
SELECT COUNT(DISTINCT i.invoice_doc)
FROM invoice_dump i
JOIN payment_dump p ON p.company_code=i.company_code
  AND p.vendor=i.vendor AND p.cleared_invoice=i.invoice_doc
  AND p.debit_credit_ind='S'
WHERE i.document_type IN ('RE','KR')
  AND i.created_by = p.created_by
  AND (i.reverse_invoice IS NULL OR i.reverse_invoice = '')`,
  },

  // ── VENDOR ────────────────────────────────────────────────────────────────

  ACTIVE_VENDOR_COUNT: {
    title: "Active Vendor Count",
    description:
      "Vendors with all 5 SAP block flags clear. Checks: central_purchasing_block ≠ 'X', central_posting_block ≠ 'X', deletion_flag_central ≠ 'X', payment_block ≠ '*' (SAP uses * not X for payment block), posting_block_cc ≠ 'X'.",
    formula: "COUNT(vendor) WHERE all 5 block flags ≠ active value (X or *)",
    sql: `SELECT COUNT(DISTINCT vendor)
FROM vendor_master
WHERE (central_purchasing_block IS NULL OR central_purchasing_block <> 'X')
  AND (central_posting_block    IS NULL OR central_posting_block    <> 'X')
  AND (deletion_flag_central    IS NULL OR deletion_flag_central    <> 'X')
  AND (payment_block            IS NULL OR payment_block            <> '*')
  AND (posting_block_cc         IS NULL OR posting_block_cc         <> 'X')`,
  },

  VENDOR_COMPLIANCE_RATE: {
    title: "Vendor Compliance Rate (%)",
    description:
      "Percentage of vendors where all 5 block fields are blank or null (strictly empty, not just 'not X'). Stricter than Active Vendor Count. Tracks vendor master hygiene.",
    formula: "COUNT(all 5 blocks = blank/null) / COUNT(all vendors) × 100",
    sql: `-- Compliant count (all 5 blocks blank):
SELECT COUNT(*) FROM vendor_master
WHERE (central_purchasing_block IS NULL OR central_purchasing_block = '')
  AND (central_posting_block    IS NULL OR central_posting_block    = '')
  AND (deletion_flag_central    IS NULL OR deletion_flag_central    = '')
  AND (payment_block            IS NULL OR payment_block            = '')
  AND (posting_block_cc         IS NULL OR posting_block_cc         = '')

-- Total:
-- SELECT COUNT(*) FROM vendor_master
-- Python: round(compliant / total * 100, 2)`,
  },

  VENDOR_DELIVERY_DAYS: {
    title: "Avg Vendor Delivery Lead Time (days)",
    description:
      "Average days between PO scheduled delivery date (po_dump.delivery_date = EKET-EINDT) and first GRN entry_date (grn_dump.entry_date = AEDAT — recording date, not posting_date). Positive = late, negative = early. Per-vendor breakdown stored as JSON for the chart.",
    formula: "AVG(first_grn_entry_date − po.delivery_date) per vendor → overall average",
    sql: `WITH grn_first AS (
  SELECT purchasing_document, item,
         MIN(entry_date) AS first_grn_date
  FROM grn_dump
  WHERE debit_credit_ind = 'S'
    AND entry_date IS NOT NULL AND entry_date != ''
  GROUP BY purchasing_document, item
)
SELECT ROUND(AVG(
  (gf.first_grn_date::DATE - po.delivery_date::DATE)::FLOAT
), 1)
FROM po_dump po
JOIN grn_first gf
  ON gf.purchasing_document = po.purchasing_document
 AND gf.item               = po.item
WHERE (po.deletion_indicator IS NULL
       OR po.deletion_indicator NOT IN ('L','X'))
  AND po.delivery_date IS NOT NULL AND po.delivery_date != ''`,
  },

  AVG_DELIVERY_DELAY: {
    title: "Avg Delivery Delay (days, late only)",
    description:
      "Average delay for late deliveries only — GRN posting_date > expected_delivery_date from po_delivery_dump (EKET schedule lines). Early and on-time deliveries are excluded from this average.",
    formula: "AVG(grn.posting_date − pod.expected_delivery_date) WHERE grn_date > expected_date",
    sql: `SELECT AVG((grn.posting_date::DATE
          - pod.expected_delivery_date::DATE)::FLOAT)
FROM po_delivery_dump pod
JOIN grn_dump grn
  ON grn.purchasing_document = pod.purchasing_document
 AND grn.item               = pod.item
WHERE grn.debit_credit_ind  = 'S'
  AND grn.posting_date > pod.expected_delivery_date`,
  },

  BLOCKED_VENDOR_COUNT: {
    title: "Blocked Vendor Count",
    description:
      "Vendors with at least one active block across 4 flag fields: central purchasing block (X), central posting block (X), payment block (*), or company-level posting block (X). Deletion flag is tracked separately.",
    formula: "COUNT(vendor) WHERE central_purchasing_block='X' OR central_posting_block='X' OR payment_block='*' OR posting_block_cc='X'",
    sql: `SELECT COUNT(DISTINCT vendor)
FROM vendor_master
WHERE central_purchasing_block = 'X'
   OR central_posting_block    = 'X'
   OR payment_block            = '*'
   OR posting_block_cc         = 'X'`,
  },

  VENDOR_MASTER_CHANGES: {
    title: "Vendor Master Changes (MTD)",
    description:
      "Count of distinct vendor master records (object_class = 'KRED') changed this month, from the change_log. Counts unique vendor object IDs — not total rows. Frequent changes to bank account fields are a fraud indicator.",
    formula: "COUNT(DISTINCT object_id) WHERE object_class='KRED' AND change_date ≥ month start",
    sql: `SELECT COUNT(DISTINCT object_id)
FROM change_log
WHERE object_class = 'KRED'
  AND change_date  >= {MTD}`,
  },

  // ── UTILIZATION (CAPEX / OPEX) ────────────────────────────────────────────

  CAPEX_SPEND_YTD: {
    title: "Total CAPEX Spend (YTD)",
    description:
      "Sum of PO net order values flagged as CAPEX this financial year (by document_date). COALESCE defaults null/blank capex_opex_flag to 'OPEX', so only explicitly tagged CAPEX lines are included.",
    formula: "SUM(net_order_value) WHERE UPPER(COALESCE(capex_opex_flag,'OPEX'))='CAPEX' AND document_date ≥ FY",
    sql: `SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL
       OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= {FY}
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'CAPEX'`,
  },

  OPEX_SPEND_YTD: {
    title: "Total OPEX Spend (YTD)",
    description:
      "Sum of PO net order values flagged as OPEX or untagged (null/blank defaults to OPEX) this financial year.",
    formula: "SUM(net_order_value) WHERE UPPER(COALESCE(capex_opex_flag,'OPEX'))='OPEX' AND document_date ≥ FY",
    sql: `SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL
       OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= {FY}
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'OPEX'`,
  },

  CAPEX_PCT: {
    title: "CAPEX as % of Total Spend",
    description:
      "CAPEX as a share of combined CAPEX + OPEX spend. Computed in Python from the already-fetched U1 and U2 values — no separate SQL query.",
    formula: "CAPEX_SPEND_YTD / (CAPEX_SPEND_YTD + OPEX_SPEND_YTD) × 100",
    sql: `-- No standalone SQL — derived from U1 and U2 in Python:
-- total_spend = (u1 or 0) + (u2 or 0)
-- capex_pct   = round((u1 or 0) / total_spend * 100, 1)
--               if total_spend else None`,
  },

  OPEX_PCT: {
    title: "OPEX as % of Total Spend",
    description:
      "OPEX as a share of combined CAPEX + OPEX spend. Computed in Python from U1 and U2.",
    formula: "OPEX_SPEND_YTD / (CAPEX_SPEND_YTD + OPEX_SPEND_YTD) × 100",
    sql: `-- No standalone SQL — derived from U1 and U2 in Python:
-- total_spend = (u1 or 0) + (u2 or 0)
-- opex_pct    = round((u2 or 0) / total_spend * 100, 1)
--               if total_spend else None`,
  },

  CAPEX_PO_COUNT: {
    title: "CAPEX PO Count (YTD)",
    description: "Count of distinct CAPEX purchase orders for the current financial year.",
    formula: "COUNT(DISTINCT purchasing_document) WHERE CAPEX AND document_date ≥ FY AND not deleted",
    sql: `SELECT COUNT(DISTINCT purchasing_document)
FROM po_dump
WHERE (deletion_indicator IS NULL
       OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= {FY}
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'CAPEX'`,
  },

  OPEX_PO_COUNT: {
    title: "OPEX PO Count (YTD)",
    description: "Count of distinct OPEX purchase orders for the current financial year.",
    formula: "COUNT(DISTINCT purchasing_document) WHERE OPEX AND document_date ≥ FY AND not deleted",
    sql: `SELECT COUNT(DISTINCT purchasing_document)
FROM po_dump
WHERE (deletion_indicator IS NULL
       OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= {FY}
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'OPEX'`,
  },

  CAPEX_AVG_PO_VALUE: {
    title: "Avg CAPEX PO Value",
    description:
      "Mean net order value per CAPEX PO line. Note: no FY date filter — uses all historical CAPEX POs for a stable long-run average.",
    formula: "AVG(net_order_value) WHERE CAPEX AND not deleted (all time, no FY filter)",
    sql: `SELECT AVG(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL
       OR deletion_indicator NOT IN ('L','X'))
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'CAPEX'`,
  },

  OPEX_AVG_PO_VALUE: {
    title: "Avg OPEX PO Value",
    description:
      "Mean net order value per OPEX PO line. No FY date filter — all-time average.",
    formula: "AVG(net_order_value) WHERE OPEX AND not deleted (all time, no FY filter)",
    sql: `SELECT AVG(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL
       OR deletion_indicator NOT IN ('L','X'))
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'OPEX'`,
  },

  CAPEX_PENDING_VALUE: {
    title: "CAPEX Pending Delivery",
    description:
      "Total CAPEX PO value not yet delivery-completed (delivery_completed is blank/null on the PO line). Uses only the PO's own delivery_completed flag — no GRN check.",
    formula: "SUM(net_order_value) WHERE CAPEX AND delivery_completed blank AND not deleted",
    sql: `SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL
       OR deletion_indicator NOT IN ('L','X'))
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'CAPEX'
  AND (delivery_completed IS NULL OR delivery_completed = '')`,
  },

  OPEX_PENDING_VALUE: {
    title: "OPEX Pending Delivery",
    description:
      "Total OPEX PO value not yet delivery-completed. Uses the PO line's own delivery_completed flag.",
    formula: "SUM(net_order_value) WHERE OPEX AND delivery_completed blank AND not deleted",
    sql: `SELECT SUM(CAST(net_order_value AS REAL))
FROM po_dump
WHERE (deletion_indicator IS NULL
       OR deletion_indicator NOT IN ('L','X'))
  AND UPPER(COALESCE(capex_opex_flag,'OPEX')) = 'OPEX'
  AND (delivery_completed IS NULL OR delivery_completed = '')`,
  },

  // ── SOFTWARE LICENSE UTILIZATION ──────────────────────────────────────────

  SW_LIC_UTIL_RATE: {
    title: "Avg Software License Utilization Rate (%)",
    description:
      "Average utilization rate across all software tools in the license_usage table. Computed as active_users ÷ total_licenses per tool, averaged across all tools. Values below 70% trigger under-utilization warnings.",
    formula: "AVG(active_users / total_licenses × 100) across all tools in license_usage",
    sql: `SELECT tool_name, total_licenses, active_users,
       ROUND(active_users * 100.0 / NULLIF(total_licenses, 0), 1) AS util_pct
FROM license_usage
-- Python: AVG of util_pct across all tools`,
  },

  SW_UNDERUTIL_COUNT: {
    title: "Under-Utilized Software Tools",
    description:
      "Count of software tools where utilization rate is below 70% (active_users < 70% of total_licenses). These are candidates for license right-sizing or contract renegotiation.",
    formula: "COUNT(tools) WHERE active_users / total_licenses < 0.70",
    sql: `SELECT COUNT(*) FROM license_usage
WHERE total_licenses > 0
  AND CAST(active_users AS REAL) / total_licenses < 0.70`,
  },

  SW_TOTAL_LICENSES: {
    title: "Total Licensed Seats",
    description:
      "Sum of total_licenses across all software tools in license_usage. Represents total contracted software seats regardless of usage.",
    formula: "SUM(total_licenses) FROM license_usage",
    sql: `SELECT SUM(total_licenses) FROM license_usage`,
  },

  SW_ACTIVE_USERS: {
    title: "Total Active License Users",
    description:
      "Sum of active_users across all software tools. Represents the number of seats actively in use as of the last license_usage data upload.",
    formula: "SUM(active_users) FROM license_usage",
    sql: `SELECT SUM(active_users) FROM license_usage`,
  },

  SW_UNUSED_SEATS: {
    title: "Unused License Seats",
    description:
      "Total licensed seats minus total active users across all tools. These are paid-for seats generating zero value — direct cost waste.",
    formula: "SUM(total_licenses) − SUM(active_users) FROM license_usage",
    sql: `SELECT SUM(total_licenses) - SUM(active_users) AS unused
FROM license_usage`,
  },

  SW_ANNUAL_COST: {
    title: "Total Annual SW License Cost (₹ Cr)",
    description:
      "Sum of annual_cost_inr across all tools in license_usage. Represents total committed software license expenditure per annum. Displayed in INR Crore.",
    formula: "SUM(annual_cost_inr) / 1e7 FROM license_usage",
    sql: `SELECT SUM(annual_cost_inr) / 1e7 AS cost_cr FROM license_usage`,
  },

  SW_COST_PER_USER: {
    title: "Effective Cost Per Active User (INR)",
    description:
      "Total annual software license cost divided by total active users. Measures effective per-user spend — rising cost-per-user indicates under-utilization or price increases.",
    formula: "SUM(annual_cost_inr) / SUM(active_users) FROM license_usage",
    sql: `SELECT ROUND(SUM(annual_cost_inr) / NULLIF(SUM(active_users), 0), 0)
FROM license_usage`,
  },

  SW_WASTED_COST: {
    title: "Wasted License Cost — Under-Utilized Tools (₹ Cr)",
    description:
      "Estimated cost of licenses being wasted on under-utilized tools (util < 70%). Calculated as annual_cost_inr × (1 − utilization_rate) for each tool below 70%. This represents immediately recoverable savings.",
    formula: "SUM(annual_cost_inr × (1 − util_rate)) WHERE util_rate < 0.70",
    sql: `SELECT SUM(annual_cost_inr * (1.0 - CAST(active_users AS REAL) / total_licenses)) / 1e7
FROM license_usage
WHERE total_licenses > 0
  AND CAST(active_users AS REAL) / total_licenses < 0.70`,
  },

  SW_RENEWAL_90D: {
    title: "Software Licenses Renewing Within 90 Days",
    description:
      "Count of software tools with renewal_date within 90 days of today. These are contracts that need review — decide to renew at current scale, right-size, or cancel based on utilization data.",
    formula: "COUNT(tools) WHERE renewal_date − TODAY ≤ 90 days",
    sql: `SELECT COUNT(*) FROM license_usage
WHERE renewal_date IS NOT NULL
  AND (renewal_date::DATE - CURRENT_DATE) <= 90`,
  },

  SW_TOOL_BREAKDOWN: {
    title: "Per-Tool License Breakdown (JSON)",
    description:
      "JSON array of all software tools with: tool name, total seats, active users, unused seats, utilization %, annual cost (₹ Cr), renewal date, and risk level (HIGH < 50%, MEDIUM < 70%, LOW ≥ 70%). Used to power the tool-level table in the UI.",
    formula: "JSON per tool: util_pct, unused, cost_cr, risk = HIGH/MEDIUM/LOW",
    sql: `SELECT tool_name, total_licenses, active_users,
       total_licenses - active_users AS unused,
       ROUND(active_users * 100.0 / NULLIF(total_licenses,0), 1) AS util_pct,
       ROUND(annual_cost_inr / 1e7, 2) AS cost_cr,
       renewal_date
FROM license_usage
-- Risk: HIGH if util<50%, MEDIUM if <70%, else LOW`,
  },

  SW_CAPEX_SPEND: {
    title: "Software CAPEX Spend YTD (₹ Cr)",
    description:
      "Total PO net order value for SOFTWARE-categorized POs flagged as CAPEX (perpetual licenses, one-time ERP licenses) in the current financial year. Source: po_dump joined to po_categorization.",
    formula: "SUM(net_order_value) / 1e7 WHERE po_category='SOFTWARE' AND capex_opex_flag='CAPEX' AND FY",
    sql: `SELECT SUM(CAST(p.net_order_value AS REAL)) / 1e7
FROM po_dump p
JOIN po_categorization c
  ON p.purchasing_document = c.purchasing_document AND p.item = c.item
WHERE c.po_category = 'SOFTWARE'
  AND c.capex_opex_flag = 'CAPEX'
  AND (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
  AND p.document_date >= {FY}`,
  },

  SW_OPEX_SPEND: {
    title: "Software OPEX Spend YTD (₹ Cr)",
    description:
      "Total PO net order value for SOFTWARE-categorized POs flagged as OPEX (subscriptions, SaaS, maintenance contracts) in the current financial year.",
    formula: "SUM(net_order_value) / 1e7 WHERE po_category='SOFTWARE' AND capex_opex_flag='OPEX' AND FY",
    sql: `SELECT SUM(CAST(p.net_order_value AS REAL)) / 1e7
FROM po_dump p
JOIN po_categorization c
  ON p.purchasing_document = c.purchasing_document AND p.item = c.item
WHERE c.po_category = 'SOFTWARE'
  AND c.capex_opex_flag = 'OPEX'
  AND (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
  AND p.document_date >= {FY}`,
  },

  SW_VENDOR_CONC: {
    title: "Top SW Vendor Spend Concentration (%)",
    description:
      "Percentage of total software PO spend attributable to the single largest vendor. Values above 50% indicate high vendor dependency risk for software supply.",
    formula: "top_vendor_spend / total_sw_spend × 100",
    sql: `SELECT vendor_name, SUM(CAST(net_order_value AS REAL)) AS spend
FROM po_dump p
JOIN po_categorization c
  ON p.purchasing_document = c.purchasing_document AND p.item = c.item
WHERE c.po_category = 'SOFTWARE'
  AND (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
GROUP BY vendor_name
ORDER BY spend DESC LIMIT 8
-- Python: top_vendor_spend / total_sw_spend × 100`,
  },

  SW_VENDOR_BREAKDOWN: {
    title: "Software Vendor Spend Breakdown (JSON)",
    description:
      "JSON array of top 8 software vendors by PO spend, with spend in ₹ Cr and percentage share of total software spend. Used to power the vendor bar chart.",
    formula: "Top-8 vendors by SUM(net_order_value) WHERE po_category='SOFTWARE'",
    sql: `SELECT p.vendor_name,
       SUM(CAST(p.net_order_value AS REAL)) / 1e7 AS spend_cr
FROM po_dump p
JOIN po_categorization c
  ON p.purchasing_document = c.purchasing_document AND p.item = c.item
WHERE c.po_category = 'SOFTWARE'
  AND (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
GROUP BY p.vendor_name
ORDER BY spend_cr DESC LIMIT 8`,
  },

  // ── MATERIALS UTILIZATION ──────────────────────────────────────────────────

  MAT_DELIV_UTIL_RATE: {
    title: "Material Delivery Utilization Rate (%)",
    description:
      "GRN (Goods Receipt) quantity received as a percentage of total ordered quantity on material POs. 100% = all ordered goods received. Low values indicate open purchase commitments awaiting delivery.",
    formula: "SUM(grn_qty WHERE mvt=101 & dc=S) / SUM(po_order_quantity) × 100 for MATERIAL category POs",
    sql: `SELECT SUM(CAST(COALESCE(NULLIF(g.quantity,''),'0') AS REAL)) AS grn_qty,
       SUM(CAST(COALESCE(NULLIF(p.order_quantity,''),'0') AS REAL)) AS po_qty
FROM po_dump p
JOIN grn_dump g
  ON p.purchasing_document = g.purchasing_document AND p.item = g.item
LEFT JOIN po_categorization c
  ON p.purchasing_document = c.purchasing_document AND p.item = c.item
WHERE g.movement_type = '101' AND g.debit_credit_ind = 'S'
  AND (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
  AND (c.po_category IS NULL OR c.po_category = 'MATERIAL')
-- Python: ROUND(grn_qty / po_qty * 100, 1)`,
  },

  MAT_DELIVERY_COMPLETE_PCT: {
    title: "Delivery Completed POs (%)",
    description:
      "Percentage of material PO lines where SAP delivery_completed flag is set to 'X'. This is the SAP ELIKZ field from EKPO — manually or automatically set when all scheduled deliveries are received.",
    formula: "COUNT(delivery_completed='X') / COUNT(*) × 100 WHERE FY and not deleted",
    sql: `SELECT COUNT(CASE WHEN delivery_completed='X' THEN 1 END) * 100.0
       / NULLIF(COUNT(*), 0)
FROM po_dump
WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
  AND document_date >= {FY}`,
  },

  MAT_OPEN_PO_VALUE: {
    title: "Open PO Value Not Yet GRN'd (₹ Cr)",
    description:
      "Total outstanding PO value where GRN amount received is more than 5% less than PO net value. Represents committed spend awaiting goods receipt — a working capital liability.",
    formula: "SUM(po_net_value − grn_amount) WHERE grn_amount < po_net_value × 0.95",
    sql: `SELECT SUM(f.po_net_value - COALESCE(f.grn_amount, 0)) / 1e7
FROM pr_po_grn_invoice f
WHERE f.po_deletion_indicator NOT IN ('L','X')
  AND COALESCE(f.grn_amount, 0) < f.po_net_value * 0.95
  AND f.po_net_value > 0`,
  },

  MAT_CAPEX_SPEND: {
    title: "Material CAPEX Spend YTD (₹ Cr)",
    description:
      "Total PO net order value for MATERIAL-categorized POs flagged as CAPEX (machinery, equipment, capital assets). Source: po_dump joined to po_categorization.",
    formula: "SUM(net_order_value) / 1e7 WHERE po_category='MATERIAL' AND capex_opex_flag='CAPEX' AND FY",
    sql: `SELECT SUM(CAST(p.net_order_value AS REAL)) / 1e7
FROM po_dump p
JOIN po_categorization c
  ON p.purchasing_document = c.purchasing_document AND p.item = c.item
WHERE c.po_category = 'MATERIAL'
  AND c.capex_opex_flag = 'CAPEX'
  AND (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
  AND p.document_date >= {FY}`,
  },

  MAT_OPEX_SPEND: {
    title: "Material OPEX Spend YTD (₹ Cr)",
    description:
      "Total PO net order value for MATERIAL-categorized POs flagged as OPEX (consumables, royalty materials, imported licensed materials). Source: po_dump joined to po_categorization.",
    formula: "SUM(net_order_value) / 1e7 WHERE po_category='MATERIAL' AND capex_opex_flag='OPEX' AND FY",
    sql: `SELECT SUM(CAST(p.net_order_value AS REAL)) / 1e7
FROM po_dump p
JOIN po_categorization c
  ON p.purchasing_document = c.purchasing_document AND p.item = c.item
WHERE c.po_category = 'MATERIAL'
  AND c.capex_opex_flag = 'OPEX'
  AND (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
  AND p.document_date >= {FY}`,
  },

  MAT_LICENSE_COST_TOT: {
    title: "Material Licensing Cost Total (₹ Cr)",
    description:
      "Total royalty fees, import license charges, and patent fees across all active material POs. Sourced from material_license_cost table (SAP equivalent: KONV condition types ZLIC/ZROY). These costs are in addition to the base PO net value.",
    formula: "SUM(license_fee_inr) / 1e7 FROM material_license_cost JOIN active po_dump",
    sql: `SELECT SUM(mlc.license_fee_inr) / 1e7
FROM material_license_cost mlc
JOIN po_dump p
  ON mlc.purchasing_document = p.purchasing_document AND mlc.item = p.item
WHERE (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))`,
  },

  MAT_LICENSE_BREAKDOWN: {
    title: "Material License Cost by Type (JSON)",
    description:
      "JSON breakdown of material licensing costs by type: ROYALTY (IP/technology fees), IMPORT_LICENSE (customs/DGFT), PATENT (patent usage fees). Used to power the license cost bar chart.",
    formula: "SUM(license_fee_inr) / 1e7 GROUP BY license_type FROM material_license_cost",
    sql: `SELECT mlc.license_type,
       SUM(mlc.license_fee_inr) / 1e7 AS cost_cr
FROM material_license_cost mlc
JOIN po_dump p
  ON mlc.purchasing_document = p.purchasing_document AND mlc.item = p.item
WHERE (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
GROUP BY mlc.license_type`,
  },

  MAT_3WAY_MATCH: {
    title: "3-Way Match Rate — Materials (%)",
    description:
      "Percentage of material PO lines where invoice amount matches GRN amount within 5% tolerance. Measures invoice accuracy for physical goods. Low rates indicate disputes, short-deliveries billed in full, or data quality issues.",
    formula: "COUNT(|invoice_amt − grn_amt| / grn_amt < 5%) / COUNT(lines with GRN > 0) × 100",
    sql: `SELECT
  COUNT(CASE
    WHEN f.grn_amount > 0
     AND ABS(f.invoice_amount - f.grn_amount) / NULLIF(f.grn_amount, 0) < 0.05
    THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN f.grn_amount > 0 THEN 1 END), 0)
FROM pr_po_grn_invoice f
LEFT JOIN po_categorization c
  ON f.purchasing_document = c.purchasing_document AND f.item = c.item
WHERE f.po_deletion_indicator NOT IN ('L','X')
  AND (c.po_category IS NULL OR c.po_category = 'MATERIAL')`,
  },

  MAT_VENDOR_FILL_RATE: {
    title: "Vendor GRN Fill Rate (JSON)",
    description:
      "JSON array of top 8 vendors by GRN quantity, showing their fill rate (GRN qty ÷ PO ordered qty × 100%). Color-coded: green ≥ 90%, amber ≥ 70%, red < 70%. Measures supplier delivery reliability.",
    formula: "SUM(grn_qty) / SUM(po_qty) × 100 per vendor — top 8 by GRN volume",
    sql: `SELECT p.vendor_name,
       SUM(CAST(COALESCE(NULLIF(g.quantity,''),'0') AS REAL)) AS grn_qty,
       SUM(CAST(COALESCE(NULLIF(p.order_quantity,''),'0') AS REAL)) AS po_qty
FROM po_dump p
JOIN grn_dump g
  ON p.purchasing_document = g.purchasing_document AND p.item = g.item
WHERE g.movement_type = '101' AND g.debit_credit_ind = 'S'
  AND (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
GROUP BY p.vendor_name
HAVING SUM(CAST(COALESCE(NULLIF(p.order_quantity,''),'0') AS REAL)) > 0
ORDER BY grn_qty DESC LIMIT 8`,
  },

  MAT_CAT_BREAKDOWN: {
    title: "Material Spend by Category (JSON)",
    description:
      "JSON array of material PO spend grouped by sub_category (from po_categorization) or material_group (from po_dump). Shows top 8 categories by spend in ₹ Cr with PO count. Used to power the category breakdown bar chart.",
    formula: "SUM(net_order_value) / 1e7 GROUP BY sub_category OR material_group WHERE po_category='MATERIAL'",
    sql: `SELECT COALESCE(c.sub_category, p.material_group, 'OTHER') AS cat,
       SUM(CAST(p.net_order_value AS REAL)) / 1e7 AS spend_cr,
       COUNT(DISTINCT p.purchasing_document) AS po_count
FROM po_dump p
LEFT JOIN po_categorization c
  ON p.purchasing_document = c.purchasing_document AND p.item = c.item
WHERE (p.deletion_indicator IS NULL OR p.deletion_indicator NOT IN ('L','X'))
  AND p.document_date >= {FY}
  AND (c.po_category IS NULL OR c.po_category = 'MATERIAL')
GROUP BY cat
ORDER BY spend_cr DESC LIMIT 8`,
  },
};
