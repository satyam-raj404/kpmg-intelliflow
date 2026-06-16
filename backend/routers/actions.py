"""Actions router — open POs, closed POs, PRs without PO, logged actions."""
import json
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from database import get_connection

router = APIRouter()


# ── GET /api/actions/open-pos ────────────────────────────────────────────────

@router.get("/actions/open-pos")
def get_open_pos():
    conn = get_connection()
    rows = conn.execute("""
        SELECT DISTINCT ON (purchasing_document)
               purchasing_document, item, vendor,
               COALESCE(vendor_name, vendor) AS vendor_name,
               CAST(COALESCE(NULLIF(net_order_value,''),'0') AS REAL) AS net_order_value,
               COALESCE(NULLIF(created_on,''), document_date) AS doc_date,
               material_description, material_group, company_code
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND (delivery_completed IS NULL OR delivery_completed = '')
        ORDER BY purchasing_document, COALESCE(NULLIF(created_on,''), document_date) DESC NULLS LAST
        LIMIT 100
    """).fetchall()
    return [
        {
            "purchasing_document": r[0],
            "item": r[1],
            "vendor": r[2],
            "vendor_name": r[3],
            "net_order_value": r[4],
            "doc_date": r[5],
            "material_description": r[6],
            "material_group": r[7],
            "company_code": r[8],
        }
        for r in rows
    ]


# ── GET /api/actions/closed-pos ──────────────────────────────────────────────

@router.get("/actions/closed-pos")
def get_closed_pos():
    conn = get_connection()
    rows = conn.execute("""
        SELECT DISTINCT ON (p.purchasing_document)
               p.purchasing_document, p.vendor,
               COALESCE(p.vendor_name, p.vendor) AS vendor_name,
               CAST(COALESCE(NULLIF(p.net_order_value,''),'0') AS REAL) AS net_order_value,
               COALESCE(NULLIF(p.created_on,''), p.document_date) AS doc_date,
               i.invoice_doc,
               CAST(COALESCE(NULLIF(i.amount_local_ccy,''),'0') AS REAL) AS invoice_amount
        FROM po_dump p
        LEFT JOIN po_invoice_dump i ON i.purchasing_document = p.purchasing_document
        WHERE p.delivery_completed = 'Y'
           OR p.deletion_indicator IN ('L','X')
        ORDER BY p.purchasing_document, i.invoice_doc
        LIMIT 100
    """).fetchall()
    return [
        {
            "purchasing_document": r[0],
            "vendor": r[1],
            "vendor_name": r[2],
            "net_order_value": r[3],
            "doc_date": r[4],
            "invoice_doc": r[5],
            "invoice_amount": r[6],
        }
        for r in rows
    ]


# ── GET /api/actions/pr-without-po ──────────────────────────────────────────

@router.get("/actions/pr-without-po")
def get_pr_without_po():
    conn = get_connection()
    rows = conn.execute("""
        SELECT pr.purchase_requisition, pr.item_of_requisition,
               pr.material_description,
               CAST(COALESCE(NULLIF(pr.order_quantity,''),'0') AS REAL) AS quantity,
               pr.unit_of_measure, pr.release_status,
               pr.created_on, pr.company_code
        FROM pr_dump pr
        WHERE (pr.deletion_indicator IS NULL OR pr.deletion_indicator = '')
          AND NOT EXISTS (
              SELECT 1 FROM po_dump po
              WHERE po.purchase_requisition = pr.purchase_requisition
          )
        ORDER BY pr.created_on DESC NULLS LAST
        LIMIT 100
    """).fetchall()
    return [
        {
            "purchase_requisition": r[0],
            "item_of_requisition": r[1],
            "material_description": r[2],
            "quantity": r[3],
            "unit": r[4],
            "release_status": r[5],
            "created_on": r[6],
            "company_code": r[7],
        }
        for r in rows
    ]


# ── GET /api/actions/logged ──────────────────────────────────────────────────

@router.get("/actions/logged")
def get_logged_actions():
    conn = get_connection()
    rows = conn.execute("""
        SELECT id, doc_type, doc_number, doc_item, vendor,
               changes, approver_email, notes, status, created_at
        FROM logged_actions
        ORDER BY created_at DESC
        LIMIT 100
    """).fetchall()
    return [
        {
            "id": r[0],
            "doc_type": r[1],
            "doc_number": r[2],
            "doc_item": r[3],
            "vendor": r[4],
            "changes": r[5],
            "approver_email": r[6],
            "notes": r[7],
            "status": r[8],
            "created_at": r[9],
        }
        for r in rows
    ]


# ── GET /api/actions/po-list ─────────────────────────────────────────────────

@router.get("/actions/po-list")
def get_po_list():
    conn = get_connection()
    rows = conn.execute("""
        SELECT DISTINCT ON (purchasing_document)
               purchasing_document,
               COALESCE(vendor_name, vendor) AS vendor_name,
               material_description
        FROM po_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator NOT IN ('L','X'))
          AND (delivery_completed IS NULL OR delivery_completed = '')
        ORDER BY purchasing_document DESC
        LIMIT 200
    """).fetchall()
    return [
        {
            "value": r[0],
            "label": f"{r[0]} — {r[1] or 'Unknown'}" + (f" · {r[2][:30]}" if r[2] else ""),
            "vendor_name": r[1],
        }
        for r in rows
    ]


# ── GET /api/actions/pr-list ─────────────────────────────────────────────────

@router.get("/actions/pr-list")
def get_pr_list():
    conn = get_connection()
    rows = conn.execute("""
        SELECT purchase_requisition, item_of_requisition,
               material_description
        FROM pr_dump
        WHERE (deletion_indicator IS NULL OR deletion_indicator = '')
        ORDER BY purchase_requisition DESC
        LIMIT 200
    """).fetchall()
    return [
        {
            "value": f"{r[0]}|{r[1]}",
            "label": f"{r[0]}/{r[1]} — {(r[2] or '')[:40]}",
            "purchase_requisition": r[0],
            "item_of_requisition": r[1],
        }
        for r in rows
    ]


# ── POST /api/actions/log ────────────────────────────────────────────────────

class LogActionRequest(BaseModel):
    doc_type: str
    doc_number: str
    doc_item: Optional[str] = None
    vendor: Optional[str] = None
    changes: dict
    approver_email: str
    notes: Optional[str] = None


@router.post("/actions/log", status_code=201)
def log_action(body: LogActionRequest):
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO logged_actions
            (doc_type, doc_number, doc_item, vendor, changes, approver_email, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            body.doc_type,
            body.doc_number,
            body.doc_item,
            body.vendor,
            json.dumps(body.changes),
            body.approver_email,
            body.notes,
        ),
    )
    conn.commit()
    return {"ok": True, "message": "Action logged for approver review"}
