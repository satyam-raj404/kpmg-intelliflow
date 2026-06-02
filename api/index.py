"""Vercel Python serverless entry point — wraps the FastAPI app."""
import sys
import os
import shutil

# Add backend to path
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, os.path.abspath(BACKEND_DIR))

# On Vercel, /tmp is the only writable dir; copy seeded DB there on cold start
_DB_SRC = os.path.join(BACKEND_DIR, "intellisource.db")
_DB_DEST = "/tmp/intellisource.db"

if os.path.exists(_DB_SRC) and not os.path.exists(_DB_DEST):
    shutil.copy2(_DB_SRC, _DB_DEST)

# Tell database.py where the DB lives
os.environ.setdefault("INTELLISOURCE_DB", _DB_DEST)

from main import app  # noqa: E402  — import after path/env setup
