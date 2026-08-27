"""Harness DB connection — Layers 1+2 of the read-only invariant.

The harness (Ask IntelliSource agent) NEVER uses the app's main get_connection()
(database.py), which connects with a write-capable role to the app's primary DB
(Neon). Instead it uses HARNESS_DATABASE_URL — a dedicated SELECT-only Postgres
role on local Postgres (see scripts/setup_harness_ro_role.sql), with the session
itself set read-only. Even if every application-level guard failed, Postgres
would still physically reject any write on this connection.

Layers 3-5 (write-guard regex, read-only-only tool surface, single-SELECT SQL
validator) live in guardrails.py and are applied on top of this connection.
"""
import os
import threading

import psycopg

HARNESS_DATABASE_URL = os.environ.get(
    "HARNESS_DATABASE_URL",
    "postgresql://intellisource_harness_ro:harness_ro_pw@localhost:5432/intellisource",
)

_local = threading.local()


class HarnessRow(dict):
    """dict subclass supporting both row['col'] and row[0] access."""

    def __init__(self, items):
        data = list(items)
        super().__init__(data)
        self._values = [v for _, v in data]

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._values[key]
        return super().__getitem__(key)


def _row_factory(cursor):
    cols = [c.name for c in cursor.description] if cursor.description else []
    return lambda values: HarnessRow(zip(cols, values))


def _new_connection() -> psycopg.Connection:
    conn = psycopg.connect(HARNESS_DATABASE_URL)
    conn.autocommit = True  # SELECT-only; no transaction lifecycle to manage
    conn.row_factory = _row_factory
    # Layer 2: belt-and-suspenders even though the role already defaults to this.
    conn.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
    return conn


def get_harness_connection() -> psycopg.Connection:
    """Thread-local read-only connection to the harness's dedicated DB role."""
    conn = getattr(_local, "conn", None)
    if conn is None or conn.closed:
        conn = _new_connection()
        _local.conn = conn
    return conn


def harness_select(sql: str, params: tuple = ()) -> list[dict]:
    """Run a SELECT on the harness connection. Raises on any non-SELECT the DB rejects."""
    conn = get_harness_connection()
    cur = conn.execute(sql, params)
    return [dict(r) for r in cur.fetchall()]


if __name__ == "__main__":
    rows = harness_select("SELECT COUNT(*) AS n FROM po_dump")
    assert rows[0]["n"] > 0, "expected seeded po_dump rows on local Postgres"
    try:
        get_harness_connection().execute("DELETE FROM po_dump WHERE 1=0")
        raise AssertionError("harness connection allowed a DELETE — read-only role misconfigured")
    except psycopg.errors.ReadOnlySqlTransaction:
        pass
    print("harness_db OK — read-only role verified:", rows)
