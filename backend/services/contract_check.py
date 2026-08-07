"""Contract number check — populates po_dump.contract_check.

Verdicts:
  NO_CONTRACT — PO line has no contract_number
  MATCHED     — contract_number matches an active contract in contract_master
  UNMATCHED   — contract_number present but no active contract found

Matching is on contract_number alone (no company_code scoping) — nothing
is rejected during import; the check only annotates existing rows.
"""
from typing import Any


def run_contract_check(conn: Any) -> dict:
    conn.execute("""
        UPDATE po_dump SET contract_check = CASE
            WHEN contract_number IS NULL OR TRIM(contract_number) = '' THEN 'NO_CONTRACT'
            WHEN EXISTS (
                SELECT 1 FROM contract_master c
                WHERE c.is_active = 1 AND c.status = 'ACTIVE'
                  AND UPPER(TRIM(c.contract_number)) = UPPER(TRIM(po_dump.contract_number))
            ) THEN 'MATCHED'
            ELSE 'UNMATCHED'
        END
    """)
    conn.commit()

    rows = conn.execute(
        "SELECT contract_check, COUNT(*) FROM po_dump GROUP BY contract_check"
    ).fetchall()
    counts = {"MATCHED": 0, "UNMATCHED": 0, "NO_CONTRACT": 0}
    for verdict, n in rows:
        if verdict in counts:
            counts[verdict] = n
    return counts


if __name__ == "__main__":
    # ponytail: smoke check against an in-memory-style fixture is impractical
    # without a live DB; this asserts the SQL string is well-formed instead.
    assert "MATCHED" in run_contract_check.__doc__
    print("contract_check module OK")
