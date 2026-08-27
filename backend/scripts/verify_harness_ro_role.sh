#!/bin/bash
# Verifies the harness's Postgres role can SELECT but is physically rejected on any write.
# Layers 1+2 of the read-only invariant (see ASK_INTELLISOURCE_HARNESS_PLAN.md).
set -euo pipefail

HARNESS_URL="${HARNESS_DATABASE_URL:-postgresql://intellisource_harness_ro:harness_ro_pw@localhost:5432/intellisource}"

echo "== SELECT (must succeed) =="
psql "$HARNESS_URL" -c "SELECT COUNT(*) FROM po_dump;"

fail_if_succeeds() {
    local label="$1" sql="$2"
    if psql "$HARNESS_URL" -c "$sql" >/tmp/harness_ro_check.log 2>&1; then
        echo "FAIL: $label was NOT rejected"
        exit 1
    else
        echo "OK: $label rejected — $(grep ERROR /tmp/harness_ro_check.log | head -1)"
    fi
}

fail_if_succeeds "INSERT" "INSERT INTO po_dump (purchasing_document, item, vendor, document_date, net_order_value) VALUES ('X','X','X','2026-01-01','1');"
fail_if_succeeds "UPDATE" "UPDATE po_dump SET vendor = 'X' WHERE 1=0;"
fail_if_succeeds "DELETE" "DELETE FROM po_dump WHERE 1=0;"
fail_if_succeeds "DDL"    "CREATE TABLE hax (id int);"

echo "All read-only checks passed."
