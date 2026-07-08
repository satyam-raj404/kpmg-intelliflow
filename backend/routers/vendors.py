"""Vendor CRUD router — GET /api/vendors, POST /api/vendors."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_connection
from services.audit import write_audit

router = APIRouter()


class AddVendorBody(BaseModel):
    vendor_code: str
    vendor_name: str
    vendor_address: str = ""
    country: str = ""
    contact_phone: str = ""
    contact_email: str = ""
    spoc_name: str = ""
    tax_number_pan: str = ""
    added_by: str = ""
    msme_flag: str = ""
    payment_terms: str = ""
    service_description: str = ""


@router.get("/vendors")
def list_vendors():
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT id, vendor, vendor_name, vendor_address, country, city,
               contact_phone, contact_email, spoc_name, tax_number_pan,
               msme_flag, payment_terms, service_description, added_by,
               vendor_type, uploaded_at
        FROM vendor_master
        ORDER BY id DESC
        """
    ).fetchall()
    return [dict(r) for r in rows]


@router.post("/vendors", status_code=201)
def add_vendor(body: AddVendorBody):
    if not body.vendor_code.strip():
        raise HTTPException(400, "vendor_code is required")
    if not body.vendor_name.strip():
        raise HTTPException(400, "vendor_name is required")

    conn = get_connection()
    existing = conn.execute(
        "SELECT id FROM vendor_master WHERE vendor = ?", (body.vendor_code.strip(),)
    ).fetchone()
    if existing:
        raise HTTPException(409, f"Vendor code '{body.vendor_code}' already exists")

    conn.execute(
        """
        INSERT INTO vendor_master (
            vendor, vendor_name, vendor_address, country,
            contact_phone, contact_email, spoc_name,
            tax_number_pan, added_by, msme_flag,
            payment_terms, service_description,
            city, account_group
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '')
        """,
        (
            body.vendor_code.strip(),
            body.vendor_name.strip(),
            body.vendor_address.strip(),
            body.country.strip(),
            body.contact_phone.strip(),
            body.contact_email.strip(),
            body.spoc_name.strip(),
            body.tax_number_pan.strip(),
            body.added_by.strip(),
            body.msme_flag.strip(),
            body.payment_terms.strip(),
            body.service_description.strip(),
        ),
    )
    conn.commit()
    write_audit(
        user_id=body.added_by.strip() or "admin",
        action="VENDOR_CREATED",
        entity_type="VENDOR",
        entity_id=body.vendor_code.strip(),
        details=f"name={body.vendor_name.strip()} country={body.country.strip()} msme={body.msme_flag}",
    )

    row = conn.execute(
        "SELECT * FROM vendor_master WHERE vendor = ?", (body.vendor_code.strip(),)
    ).fetchone()
    return dict(row)
