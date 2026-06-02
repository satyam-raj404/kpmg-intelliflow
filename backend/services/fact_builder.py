"""Step 4 — Rebuild pr_po_grn_invoice fact table with composite keys."""
import sqlite3


def build_entity_hierarchy(conn: sqlite3.Connection) -> None:
    """Rebuild entity_hierarchy from company_plant_master.
    Creates rollup: parent_company → company_code → purchasing_org → plant.
    """
    conn.execute("DELETE FROM entity_hierarchy")

    # Insert plant-level rows (entity_key = co_code|purch_org|plant)
    conn.execute("""
        INSERT INTO entity_hierarchy (entity_key, company_code, company_name,
                                      purchasing_org, plant, plant_name,
                                      parent_company, entity_level)
        SELECT
            'PLANT|' || cpm.company_code || '|' || cpm.purchasing_org || '|' || cpm.plant,
            cpm.company_code,
            cpm.company_name,
            cpm.purchasing_org,
            cpm.plant,
            cpm.plant_name,
            CASE WHEN cpm.parent_company IS NOT NULL AND cpm.parent_company != ''
                 THEN cpm.parent_company
                 ELSE cpm.company_name END,
            2
        FROM company_plant_master cpm
    """)

    # Insert parent-company level rows (entity_key = co_code|0000|0000)
    existing_parents = conn.execute("""
        SELECT DISTINCT parent_company, company_code, company_name
        FROM entity_hierarchy
    """).fetchall()
    seen = set()
    for row in existing_parents:
        parent = row[0] or row[2]
        if parent not in seen:
            seen.add(parent)
            conn.execute("""
                INSERT OR IGNORE INTO entity_hierarchy
                    (entity_key, company_code, company_name, purchasing_org, plant,
                     plant_name, parent_company, entity_level)
                VALUES (?, ?, ?, 'ALL', 'ALL', ?, ?, 1)
            """, (
                f"ENTITY|{parent}",
                row[1],
                parent,
                f"{parent} (Consolidated)",
                parent,
            ))

    conn.commit()


def build_facts(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM pr_po_grn_invoice")

    # ── Main insert: PO lines joined to PR, GRN, Invoice, Delivery ────────────
    conn.execute("""
        INSERT INTO pr_po_grn_invoice (
            pr_line_key, po_line_key, entity_key,
            purchase_requisition, item_of_requisition,
            purchasing_document, item,
            vendor, vendor_name,
            material_group, material_description, plant,
            purchasing_group, purchasing_org, company_code, purchasing_doc_type,
            capex_opex_flag,
            pr_quantity, pr_value, pr_delivery_date, pr_release_date, pr_requisitioner,
            po_quantity, po_net_price, po_net_value, po_document_date,
            po_delivery_date, po_deletion_indicator, po_delivery_completed,
            po_release_indicator,
            grn_quantity, grn_amount, grn_posting_date,
            invoice_quantity, invoice_amount, invoice_posting_date, invoice_due_date,
            is_maverick, has_grn_return, has_credit_memo,
            pr_to_po_days,
            po_to_grn_days, grn_to_invoice_days,
            invoice_to_payment_days, total_cycle_days
        )
        SELECT
            -- Composite line keys
            CASE WHEN pr.purchase_requisition IS NOT NULL
                 THEN 'PR|' || pr.purchase_requisition || '|' || pr.item_of_requisition
                 ELSE NULL END,
            'PO|' || po.purchasing_document || '|' || po.item,
            COALESCE(po.company_code, '1001') || '|' ||
                COALESCE(po.purchasing_org, '')  || '|' ||
                COALESCE(po.plant, ''),

            pr.purchase_requisition,
            pr.item_of_requisition,
            po.purchasing_document,
            po.item,
            po.vendor,
            po.vendor_name,
            COALESCE(po.material_group,       pr.material_group),
            COALESCE(po.material_description, pr.material_description),
            COALESCE(po.plant,                pr.plant),
            COALESCE(po.purchasing_group,     pr.purchasing_group),
            po.purchasing_org,
            COALESCE(po.company_code, '1001'),
            po.purchasing_doc_type,
            COALESCE(po.capex_opex_flag, 'OPEX'),

            -- PR amounts (item level)
            CAST(pr.order_quantity  AS REAL),
            CAST(pr.valuation_price AS REAL),
            pr.delivery_date,
            pr.release_date,
            pr.requisitioner,

            -- PO amounts
            CAST(po.order_quantity   AS REAL),
            CAST(po.net_order_price  AS REAL),
            CAST(po.net_order_value  AS REAL),
            po.document_date,
            pod.expected_delivery_date,
            po.deletion_indicator,
            po.delivery_completed,
            po.release_indicator,

            -- GRN: net quantity (receipts - returns)
            SUM(CASE WHEN grn.debit_credit_ind = 'S'
                     THEN CAST(grn.quantity        AS REAL)
                     WHEN grn.debit_credit_ind = 'H'
                     THEN -CAST(grn.quantity       AS REAL)
                     ELSE 0 END),
            SUM(CASE WHEN grn.debit_credit_ind = 'S'
                     THEN CAST(grn.amount_local_ccy AS REAL)
                     WHEN grn.debit_credit_ind = 'H'
                     THEN -CAST(grn.amount_local_ccy AS REAL)
                     ELSE 0 END),
            MIN(CASE WHEN grn.debit_credit_ind = 'S' THEN grn.posting_date END),

            -- Invoice (PO-linked, net of credit memos)
            SUM(CASE WHEN inv.debit_credit_ind = 'S'
                     THEN CAST(inv.quantity        AS REAL)
                     WHEN inv.debit_credit_ind = 'H'
                     THEN -CAST(inv.quantity       AS REAL)
                     ELSE 0 END),
            SUM(CASE WHEN inv.debit_credit_ind = 'S'
                     THEN CAST(inv.amount_local_ccy AS REAL)
                     WHEN inv.debit_credit_ind = 'H'
                     THEN -CAST(inv.amount_local_ccy AS REAL)
                     ELSE 0 END),
            MIN(CASE WHEN inv.debit_credit_ind = 'S' THEN inv.posting_date END),

            -- Due date from invoice_dump (via po_invoice_dump → invoice_dump join)
            (SELECT MIN(id_ref.due_date)
             FROM po_invoice_dump pi_ref
             JOIN invoice_dump id_ref
               ON pi_ref.invoice_doc  = id_ref.invoice_doc
              AND pi_ref.invoice_year = id_ref.invoice_year
             WHERE pi_ref.purchasing_document = po.purchasing_document
               AND pi_ref.item               = po.item
               AND pi_ref.debit_credit_ind   = 'S'),

            -- Maverick flag: 1 if no upstream PR
            CASE WHEN po.purchase_requisition IS NULL
                      OR po.purchase_requisition = ''
                 THEN 1 ELSE 0 END,

            -- Has GRN return
            CASE WHEN EXISTS (
                SELECT 1 FROM grn_dump g2
                WHERE g2.purchasing_document = po.purchasing_document
                  AND g2.item               = po.item
                  AND g2.debit_credit_ind   = 'H')
                 THEN 1 ELSE 0 END,

            -- Has credit memo
            CASE WHEN EXISTS (
                SELECT 1 FROM po_invoice_dump i2
                WHERE i2.purchasing_document = po.purchasing_document
                  AND i2.item               = po.item
                  AND i2.debit_credit_ind   = 'H')
                 THEN 1 ELSE 0 END,

            -- PR → PO days (item level: from PR release_date to PO document_date)
            CASE WHEN pr.release_date IS NOT NULL
                      AND po.document_date IS NOT NULL
                 THEN CAST(julianday(po.document_date) - julianday(pr.release_date) AS INTEGER)
                 ELSE NULL END,

            NULL, NULL, NULL, NULL   -- cycle times filled in second pass

        FROM po_dump po
        LEFT JOIN pr_dump pr
            ON po.purchase_requisition  = pr.purchase_requisition
           AND po.item_of_requisition   = pr.item_of_requisition
        LEFT JOIN po_delivery_dump pod
            ON pod.purchasing_document  = po.purchasing_document
           AND pod.item                 = po.item
        LEFT JOIN grn_dump grn
            ON grn.purchasing_document  = po.purchasing_document
           AND grn.item                 = po.item
        LEFT JOIN po_invoice_dump inv
            ON inv.purchasing_document  = po.purchasing_document
           AND inv.item                 = po.item
        WHERE (po.deletion_indicator IS NULL OR po.deletion_indicator = '')
        GROUP BY po.purchasing_document, po.item
    """)

    # ── Orphaned PRs (released but no PO yet) ─────────────────────────────────
    conn.execute("""
        INSERT INTO pr_po_grn_invoice (
            pr_line_key,
            purchase_requisition, item_of_requisition,
            material_group, material_description, plant,
            purchasing_group, company_code,
            pr_quantity, pr_value, pr_delivery_date, pr_release_date, pr_requisitioner,
            is_maverick
        )
        SELECT
            'PR|' || pr.purchase_requisition || '|' || pr.item_of_requisition,
            pr.purchase_requisition,
            pr.item_of_requisition,
            pr.material_group,
            pr.material_description,
            pr.plant,
            pr.purchasing_group,
            '1001',
            CAST(pr.order_quantity  AS REAL),
            CAST(pr.valuation_price AS REAL),
            pr.delivery_date,
            pr.release_date,
            pr.requisitioner,
            0
        FROM pr_dump pr
        WHERE pr.release_status IN ('X','XX','XXX','XXXX','XXXXX')
          AND (pr.deletion_indicator IS NULL OR pr.deletion_indicator = '')
          AND NOT EXISTS (
              SELECT 1 FROM po_dump po
              WHERE po.purchase_requisition = pr.purchase_requisition
                AND po.item_of_requisition  = pr.item_of_requisition
          )
    """)

    # ── Second pass: fill remaining cycle time columns ─────────────────────────
    conn.execute("""
        UPDATE pr_po_grn_invoice SET
            po_to_grn_days = CASE
                WHEN po_document_date IS NOT NULL AND grn_posting_date IS NOT NULL
                THEN CAST(julianday(grn_posting_date) - julianday(po_document_date) AS INTEGER)
                ELSE NULL END,

            grn_to_invoice_days = CASE
                WHEN grn_posting_date IS NOT NULL AND invoice_posting_date IS NOT NULL
                THEN CAST(julianday(invoice_posting_date) - julianday(grn_posting_date) AS INTEGER)
                ELSE NULL END,

            invoice_to_payment_days = CASE
                WHEN invoice_due_date IS NOT NULL
                THEN (
                    SELECT CAST(julianday(MIN(pay.posting_date)) - julianday(invoice_due_date) AS INTEGER)
                    FROM po_invoice_dump pi
                    JOIN invoice_dump id ON pi.invoice_doc = id.invoice_doc
                                       AND pi.invoice_year = id.invoice_year
                    JOIN payment_dump pay ON id.clearing_doc = pay.payment_doc
                    WHERE pi.purchasing_document = pr_po_grn_invoice.purchasing_document
                      AND pi.item               = pr_po_grn_invoice.item
                    LIMIT 1
                )
                ELSE NULL END,

            total_cycle_days = CASE
                WHEN pr_release_date IS NOT NULL
                THEN (
                    SELECT CAST(julianday(MIN(pay.posting_date)) - julianday(pr_po_grn_invoice.pr_release_date) AS INTEGER)
                    FROM po_invoice_dump pi
                    JOIN invoice_dump id ON pi.invoice_doc = id.invoice_doc
                                       AND pi.invoice_year = id.invoice_year
                    JOIN payment_dump pay ON id.clearing_doc = pay.payment_doc
                    WHERE pi.purchasing_document = pr_po_grn_invoice.purchasing_document
                    LIMIT 1
                )
                ELSE CASE
                    WHEN po_document_date IS NOT NULL AND grn_posting_date IS NOT NULL
                    THEN CAST(julianday(grn_posting_date) - julianday(po_document_date) AS INTEGER)
                    ELSE NULL END
                END
        WHERE purchasing_document IS NOT NULL
    """)

    conn.commit()
