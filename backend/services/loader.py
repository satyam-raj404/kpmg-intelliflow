"""Step 3 — Upsert staging tables."""
from typing import Any, Optional

import pandas as pd

# Natural keys per dataset — upsert (DELETE + INSERT) on these
NATURAL_KEYS: dict[str, list[str]] = {
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

# Computed composite keys to auto-generate during load
COMPUTED_LINE_KEYS: dict[str, tuple[str, str, list[str]]] = {
    "invoice_dump":         ("invoice_line_key", "INV|{invoice_doc}|{invoice_year}", ["invoice_doc", "invoice_year"]),
    "payment_dump":         ("payment_line_key", "PAY|{payment_doc}|{payment_year}", ["payment_doc", "payment_year"]),
    "company_plant_master": ("plant_key",         "PLANT|{company_code}|{purchasing_org}|{plant}",
                             ["company_code", "purchasing_org", "plant"]),
}


def _table_columns(conn: Any, table: str) -> list[str]:
    rows = conn.execute(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = ? "
        "ORDER BY ordinal_position",
        (table,)
    ).fetchall()
    return [r[0] for r in rows]


def load(
    df: pd.DataFrame,
    dataset_type: str,
    conn: Any,
    batch_id: str,
) -> int:
    """Upsert df into staging table. Returns rows inserted."""
    table_cols = _table_columns(conn, dataset_type)
    keys = NATURAL_KEYS.get(dataset_type, [])

    # Compute composite line keys before building insert_cols
    if dataset_type in COMPUTED_LINE_KEYS:
        col_name, template, source_cols = COMPUTED_LINE_KEYS[dataset_type]
        if col_name not in df.columns:
            def _build_key(row):
                vals = {}
                for sc in source_cols:
                    v = row.get(sc)
                    vals[sc] = "" if (v is None or (isinstance(v, float) and pd.isna(v))) else str(v)
                return template.format(**vals)
            df[col_name] = df.apply(_build_key, axis=1)

    # Columns to insert: only those present in both df and table
    insert_cols = [c for c in df.columns if c in table_cols and c not in ("id", "uploaded_at")]
    if "upload_batch_id" in table_cols and "upload_batch_id" not in insert_cols:
        insert_cols.append("upload_batch_id")

    if not insert_cols:
        return 0

    # Upsert: delete matching natural keys, then insert fresh rows
    key_cols_present = [k for k in keys if k in df.columns]
    if key_cols_present:
        unique_combos = df[key_cols_present].drop_duplicates()
        placeholders = " AND ".join(f"{k} = ?" for k in key_cols_present)
        for row in unique_combos.itertuples(index=False):
            conn.execute(
                f"DELETE FROM {dataset_type} WHERE {placeholders}",
                list(row),
            )

    col_str = ", ".join(insert_cols)
    ph_str  = ", ".join("?" * len(insert_cols))
    sql     = f"INSERT INTO {dataset_type} ({col_str}) VALUES ({ph_str})"

    records = []
    for _, row in df.iterrows():
        vals = []
        for c in insert_cols:
            if c == "upload_batch_id":
                vals.append(batch_id)
            else:
                v = row.get(c)
                vals.append(None if (v is None or (isinstance(v, float) and pd.isna(v))) else v)
        records.append(tuple(vals))

    conn.executemany(sql, records)
    conn.commit()
    return len(records)
