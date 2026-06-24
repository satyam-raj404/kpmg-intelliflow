"""Step 2 — Validation rules per dataset."""
from typing import Any, Tuple

import pandas as pd

# Composite keys per dataset for duplicate detection
COMPOSITE_KEYS: dict[str, list[str]] = {
    "pr_dump":              ["purchase_requisition", "item_of_requisition"],
    "po_dump":              ["purchasing_document", "item"],
    "po_delivery_dump":     ["purchasing_document", "item", "schedule_line"],
    "grn_dump":             ["material_document", "material_doc_item"],
    "po_invoice_dump":      ["invoice_doc", "invoice_year", "invoice_doc_item"],
    "invoice_dump":         ["invoice_doc", "invoice_year"],
    "payment_dump":         ["payment_doc", "payment_year"],
    "vendor_master":        ["vendor", "company_code"],
    "change_log":           ["change_number", "table_name", "field_name"],
    "company_plant_master": ["company_code", "purchasing_org", "plant"],
}

MANDATORY_FIELDS: dict[str, list[str]] = {
    "pr_dump": [
        "purchase_requisition", "item_of_requisition",
        "material_group", "material_description",
        "order_quantity", "delivery_date", "requisitioner",
    ],
    "po_dump": [
        "purchasing_document", "item",
        "vendor", "vendor_name",
        "document_date", "material_group", "material_description",
        "order_quantity", "net_order_value",
    ],
    "po_delivery_dump": [
        "purchasing_document", "item", "schedule_line",
        "expected_delivery_date", "scheduled_quantity", "creation_date",
    ],
    "grn_dump": [
        "purchasing_document", "item",
        "material_document", "material_doc_item",
        "po_history_category", "movement_type", "debit_credit_ind",
        "posting_date", "entry_date", "quantity", "amount_local_ccy",
    ],
    "po_invoice_dump": [
        "purchasing_document", "item",
        "invoice_doc", "invoice_year", "invoice_doc_item",
        "po_history_category", "debit_credit_ind",
        "posting_date", "entry_date", "quantity", "amount_local_ccy",
    ],
    "invoice_dump": [
        "invoice_doc", "invoice_year",
        "vendor", "document_type",
        "posting_date", "amount_local_ccy",
    ],
    "payment_dump": [
        "payment_doc", "payment_year",
        "vendor", "document_type",
        "posting_date", "clearing_date",
        "payment_method", "amount_local_ccy", "cleared_invoice", "house_bank",
    ],
    "vendor_master": [
        "vendor", "vendor_name", "country", "city", "account_group",
    ],
    "change_log": [
        "object_class", "object_id", "change_number",
        "username", "change_date", "tcode",
        "table_name", "field_name", "change_indicator",
    ],
    "company_plant_master": [
        "company_code", "company_name", "purchasing_org", "plant", "plant_name",
    ],
}

NUMERIC_FIELDS: dict[str, list[str]] = {
    "pr_dump":          ["order_quantity", "valuation_price"],
    "po_dump":          ["net_order_value", "order_quantity"],
    "po_delivery_dump": ["scheduled_quantity"],
    "grn_dump":         ["quantity", "amount_local_ccy"],
    "po_invoice_dump":  ["quantity", "amount_local_ccy"],
    "invoice_dump":     ["amount_local_ccy"],
    "payment_dump":     ["amount_local_ccy"],
    "vendor_master":    [],
    "change_log":       [],
    "company_plant_master": [],
}

ENUM_RULES: dict[str, dict[str, list[str]]] = {
    "grn_dump": {
        "po_history_category": ["E"],
        "debit_credit_ind":    ["S", "H"],
    },
    "po_invoice_dump": {
        "po_history_category": ["Q"],
        "debit_credit_ind":    ["S", "H"],
    },
}


def validate(
    df: pd.DataFrame,
    dataset_type: str,
    conn: Any,
) -> Tuple[pd.DataFrame, list[dict]]:
    rejection_log: list[dict] = []
    valid_mask = pd.Series([True] * len(df), index=df.index)

    # Rule 1: Mandatory fields not null/empty
    for field in MANDATORY_FIELDS.get(dataset_type, []):
        if field in df.columns:
            bad = df[field].isna() | (df[field].astype(str).str.strip() == "")
            for idx in df[bad].index:
                rejection_log.append({
                    "row": int(idx) + 2,
                    "field": field,
                    "reason": "Mandatory field is empty",
                })
            valid_mask &= ~bad

    # Rule 2: Numeric parse check
    for field in NUMERIC_FIELDS.get(dataset_type, []):
        if field not in df.columns:
            continue
        numeric = pd.to_numeric(df[field], errors="coerce")
        bad = numeric.isna() & df[field].notna()
        for idx in df[bad].index:
            rejection_log.append({
                "row": int(idx) + 2,
                "field": field,
                "reason": f"Cannot parse as number: '{df.at[idx, field]}'",
            })
        valid_mask &= ~bad

    # Rule 3: Value range for PO
    if dataset_type == "po_dump":
        for field in ["net_order_value", "order_quantity"]:
            if field in df.columns:
                num = pd.to_numeric(df[field], errors="coerce").fillna(0)
                bad = num < 0
                for idx in df[bad].index:
                    rejection_log.append({
                        "row": int(idx) + 2,
                        "field": field,
                        "reason": f"Value must be ≥ 0, got {df.at[idx, field]}",
                    })
                valid_mask &= ~bad

    # Rule 4: PO referential integrity for GRN and PO invoice
    # WARN only (do not reject) — allows uploads before PO data
    if dataset_type in ("grn_dump", "po_invoice_dump") and "purchasing_document" in df.columns:
        try:
            known_pos = {r[0] for r in conn.execute(
                "SELECT DISTINCT purchasing_document FROM po_dump").fetchall()}
            if known_pos:
                bad = df["purchasing_document"].notna() & ~df["purchasing_document"].isin(known_pos)
                for idx in df[bad].index:
                    rejection_log.append({
                        "row": int(idx) + 2,
                        "field": "purchasing_document",
                        "reason": f"WARN: PO '{df.at[idx, 'purchasing_document']}' not in po_dump — row accepted",
                        "warn_only": True,
                    })
                # Do NOT add to valid_mask exclusion — warn only
        except Exception:
            pass

    # Rule 5: Enum enforcement
    for field, allowed in ENUM_RULES.get(dataset_type, {}).items():
        if field in df.columns:
            bad = df[field].notna() & ~df[field].isin(allowed)
            for idx in df[bad].index:
                rejection_log.append({
                    "row": int(idx) + 2,
                    "field": field,
                    "reason": f"Value '{df.at[idx, field]}' not in {allowed}",
                })
            valid_mask &= ~bad

    # Rule 6: Composite-key duplicate detection
    comp_key_cols = COMPOSITE_KEYS.get(dataset_type, [])
    comp_key_cols_present = [c for c in comp_key_cols if c in df.columns]
    if len(comp_key_cols_present) == len(comp_key_cols):
        def _make_key(row):
            return "|".join(str(row[c]) for c in comp_key_cols_present)
        keys = df[comp_key_cols_present].apply(_make_key, axis=1)

        # 6a: Duplicates within the incoming data
        dupe_mask = keys.duplicated(keep="first")
        for idx in df[dupe_mask].index:
            rejection_log.append({
                "row": int(idx) + 2,
                "field": "|".join(comp_key_cols_present),
                "reason": f"Duplicate composite key in upload: '{keys.at[idx]}'",
            })
        valid_mask &= ~dupe_mask

        # 6b: Duplicates against existing DB data (warn only — allows re-upload)
        # Single bulk fetch instead of N per-row queries (avoids N×latency on remote DBs)
        try:
            table_cols = [r[0] for r in conn.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = ? "
                "ORDER BY ordinal_position",
                (dataset_type,)).fetchall()]
            if all(c in table_cols for c in comp_key_cols_present):
                col_list = ", ".join(comp_key_cols_present)
                existing_rows = conn.execute(
                    f"SELECT {col_list} FROM {dataset_type}"
                ).fetchall()
                existing_keys = {
                    "|".join(str(r[c]) for c in comp_key_cols_present)
                    for r in existing_rows
                }
                for idx in df[valid_mask].index:
                    k = keys.at[idx]
                    if k in existing_keys:
                        rejection_log.append({
                            "row": int(idx) + 2,
                            "field": "|".join(comp_key_cols_present),
                            "reason": f"WARN: composite key '{k}' already exists in DB — row accepted",
                            "warn_only": True,
                        })
        except Exception:
            pass

    valid_df = df[valid_mask].reset_index(drop=True)
    return valid_df, rejection_log
