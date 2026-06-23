"""Step 1 — File parsing, column normalization, dataset auto-detection."""
import io
import re
from typing import Tuple

import pandas as pd
from dateutil import parser as _dateparser

# Minimum signature columns required per dataset to auto-detect type
DATASET_SIGNATURES: dict[str, list[str]] = {
    "pr_dump":          ["purchase_requisition", "item_of_requisition", "requisitioner", "valuation_price"],
    "po_dump":          ["purchasing_document", "item", "net_order_value", "vendor", "vendor_name"],
    "po_delivery_dump": ["purchasing_document", "schedule_line", "expected_delivery_date", "scheduled_quantity"],
    "grn_dump":         ["material_document", "po_history_category", "movement_type", "debit_credit_ind"],
    "po_invoice_dump":  ["invoice_doc", "po_history_category", "invoice_doc_item", "debit_credit_ind"],
    "invoice_dump":     ["invoice_doc", "document_type", "clearing_doc", "vendor_invoice_ref"],
    "payment_dump":     ["payment_doc", "payment_method", "cleared_invoice", "clearing_date"],
    "vendor_master":    ["vendor", "vendor_name", "account_group", "central_purchasing_block"],
    "change_log":       ["object_class", "object_id", "change_number", "field_name", "change_indicator"],
    "company_plant_master": ["company_code", "purchasing_org", "plant", "plant_name"],
}

# SAP raw field → IntelliSource canonical name
# Order matters for some overloaded SAP fields — more specific aliases listed first
SAP_ALIASES: dict[str, str] = {
    # ── PO / PR document numbers ──
    "ebeln":         "purchasing_document",
    "ebelp":         "item",
    "banfn":         "purchase_requisition",
    "bnfpo":         "item_of_requisition",

    # ── Vendor ──
    "lifnr":         "vendor",
    "name1":         "vendor_name",

    # ── Material / description ──
    "matnr":         "material",
    "matkl":         "material_group",
    "txz01":         "material_description",

    # ── GRN / invoice doc numbers (EKBE) ──
    "belnr":         "material_document",   # overloaded — context sets final name
    "buzei":         "material_doc_item",
    "vgabe":         "po_history_category",

    # ── Dates ──
    "budat":         "posting_date",
    "cpudt":         "entry_date",
    "bedat":         "document_date",
    "erdat":         "created_on",
    "bldat":         "vendor_invoice_date",

    # ── People ──
    "ernam":         "created_by",
    "afnam":         "requisitioner",

    # ── Amounts ──
    "dmbtr":         "amount_local_ccy",
    "menge":         "order_quantity",
    "netwr":         "net_order_value",
    "netpr":         "net_order_price",

    # ── PO control fields ──
    "loekz":         "deletion_indicator",  # L=line deleted (EKPO-LOEKZ)
    "elikz":         "delivery_completed",
    "frgzu":         "release_status",
    "frgdt":         "release_date",
    "frgke":         "release_indicator",
    "frgrl":         "release_strategy",

    # ── PO header fields ──
    "bukrs":         "company_code",
    "ekorg":         "purchasing_org",
    "ekgrp":         "purchasing_group",
    "bsart":         "purchasing_doc_type",
    "werks":         "plant",
    "lgort":         "storage_location",
    "waers":         "currency_key",
    "shkzg":         "debit_credit_ind",
    "bwart":         "movement_type",
    "xblnr":         "reference_doc",
    "gjahr":         "invoice_year",
    "meins":         "unit_of_measure",
    "peinh":         "price_unit",
    "preis":         "valuation_price",
    "lfdat":         "delivery_date",

    # ── Invoice (BSIK/BSAK) ──
    "zfbdt":         "baseline_date",     # SAP baseline date (ZFBDT)
    "zbd3t":         "days_1",            # Net payment days (ZBD3T)
    "zterm":         "payment_terms",
    "zlspr":         "payment_block",
    "augbl":         "clearing_doc",
    "augdt":         "clearing_date",
    "blart":         "document_type",
    "xblnr_bsik":   "vendor_invoice_ref",
    "wmwst":         "tax_amount",

    # ── Payment (BSAK) ──
    "hbkid":         "house_bank",
    "zlsch":         "payment_method",
    "rebzg":         "cleared_invoice",
    "sknto":         "discount_taken",

    # ── Vendor master (LFA1/LFB1) ──
    "ktokk":         "account_group",
    "land1":         "country",
    "ort01":         "city",
    "pstlz":         "postal_code",
    "regio":         "region",
    "stcd3":         "tax_number_pan",
    "sperr":         "central_purchasing_block",
    "sperm":         "central_posting_block",
    "loevm":         "deletion_flag_central",
    "zahls":         "payment_block",

    # ── Change log (CDHDR/CDPOS) ──
    "objectclas":    "object_class",
    "objectid":      "object_id",
    "changenr":      "change_number",
    "username":      "username",
    "udate":         "change_date",
    "utime":         "change_time",
    "tcode":         "tcode",
    "tabname":       "table_name",
    "fname":         "field_name",
    "chngind":       "change_indicator",
    "value_old":     "old_value",
    "value_new":     "new_value",

    # ── Delivery schedule (EKET) ──
    "eindt":         "expected_delivery_date",
    "etenr":         "schedule_line",
    "wemng":         "delivered_quantity",
    "slfdt":         "statistical_delivery_date",

    # ── Company/plant master ──
    "plant_name":    "plant_name",
    "company_name":  "company_name",
    "parent_company": "parent_company",

    # ── Additional fields ──
    "msme_flag":     "msme_flag",
    "vendor_type":   "vendor_type",
    "capex_opex_flag": "capex_opex_flag",
}


def _normalize_col(col: str) -> str:
    col = col.strip().lower()
    col = re.sub(r"\s+", "_", col)
    col = re.sub(r"[^a-z0-9_/]", "", col)
    return SAP_ALIASES.get(col, col)


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [_normalize_col(c) for c in df.columns]
    # Deduplicate columns — keep first occurrence
    df = df.loc[:, ~df.columns.duplicated()]
    return df


def _parse_date_str(val: str) -> str | None:
    """Parse a single date string to YYYY-MM-DD, return None on failure."""
    if not val or val in ("nan", "NaN", "NULL", "None", ""):
        return None
    v = str(val).strip()
    try:
        # YYYYMMDD compact
        clean = v.replace("-", "")
        if clean.isdigit() and len(clean) == 8:
            return f"{clean[:4]}-{clean[4:6]}-{clean[6:8]}"
        return _dateparser.parse(v, dayfirst=False).strftime("%Y-%m-%d")
    except Exception:
        return None


def _normalize_dates(df: pd.DataFrame) -> pd.DataFrame:
    date_pat = re.compile(r"(date|_on$|_at$)")
    for col in df.columns:
        if date_pat.search(col) and df[col].dtype == object:
            try:
                df[col] = df[col].map(_parse_date_str)
            except Exception:
                pass
    return df


def _compute_due_date(df: pd.DataFrame) -> pd.DataFrame:
    """If baseline_date and days_1 are present, (re)calculate due_date."""
    if "baseline_date" in df.columns and "days_1" in df.columns:
        try:
            from datetime import timedelta
            def _add_days(row):
                bd = row["baseline_date"]
                if not bd:
                    return None
                try:
                    days = int(float(row["days_1"])) if row.get("days_1") else 30
                    base = _dateparser.parse(str(bd))
                    return (base + timedelta(days=days)).strftime("%Y-%m-%d")
                except Exception:
                    return None

            if "due_date" not in df.columns or df["due_date"].isna().all():
                df["due_date"] = df.apply(_add_days, axis=1)
            else:
                mask = df["due_date"].isna() | (df["due_date"].astype(str).str.strip() == "")
                df.loc[mask, "due_date"] = df[mask].apply(_add_days, axis=1)
        except Exception:
            pass
    return df


def detect_dataset(df: pd.DataFrame) -> str:
    cols = set(df.columns.tolist())
    best, best_score = "UNKNOWN", 0
    for dataset, sig in DATASET_SIGNATURES.items():
        score = sum(1 for s in sig if s in cols)
        if score > best_score:
            best, best_score = dataset, score
    if best_score < 3:
        raise ValueError(
            f"Cannot identify dataset — only {best_score} signature columns matched (need ≥3). "
            f"Columns found: {sorted(cols)}"
        )
    return best


def parse_file(file_bytes: bytes, filename: str) -> Tuple[pd.DataFrame, str]:
    fname = filename.lower()
    try:
        if fname.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)
        elif fname.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_bytes), dtype=str, keep_default_na=False)
        else:
            raise ValueError("Unsupported file type. Upload CSV or Excel (.xlsx/.xls).")
    except Exception as e:
        raise ValueError(f"Cannot read file: {e}")

    if df.empty:
        raise ValueError("File has no data rows.")

    df = normalize_columns(df)
    df = _normalize_dates(df)

    # Strip whitespace from all string columns
    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].str.strip()

    # Replace empty / null-like strings with None
    df = df.replace({"": None, "nan": None, "NaN": None, "NULL": None, "None": None})

    # Compute due_date from baseline_date + days_1 if available
    df = _compute_due_date(df)

    dataset_type = detect_dataset(df)
    return df, dataset_type
