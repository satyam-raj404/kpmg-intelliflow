"""Ensures the target Postgres database exists before schema init runs.

schema.sql / database.init_db() assume the database itself already exists —
they only create tables inside it. On a fresh Postgres install (e.g. the KPMG
on-prem server) the `intellisource` database itself is usually missing, which
makes every connection fail before schema init ever gets a chance to run.
This connects to the server's default `postgres` database and creates the
target database if it isn't there yet. Safe to run every time — idempotent.

Used by init_kpmg.py; can also be run standalone:
    python backend/scripts/ensure_db.py
"""
import os
import sys
from urllib.parse import urlparse

import psycopg

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:1234@localhost:5432/intellisource",
)


def main() -> None:
    parsed = urlparse(DATABASE_URL)
    dbname = parsed.path.lstrip("/") or "intellisource"
    admin_url = DATABASE_URL.rsplit("/", 1)[0] + "/postgres"

    conn = psycopg.connect(admin_url, autocommit=True)
    try:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (dbname,)
        ).fetchone()
        if exists:
            print(f"[ensure_db] Database {dbname!r} already exists.")
        else:
            conn.execute(f'CREATE DATABASE "{dbname}"')
            print(f"[ensure_db] Created database {dbname!r}.")
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[ensure_db] Could not verify/create database: {exc}", file=sys.stderr)
        print("[ensure_db] Check Postgres is running and DATABASE_URL credentials are correct.", file=sys.stderr)
        sys.exit(1)
