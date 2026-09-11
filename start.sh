#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# IntelliSource — one-command launcher
#
#   ./start.sh
#
# Does everything:
#   1. Creates a Python venv named "Intl" (reuses it if already there)
#   2. Installs backend/requirements.txt (+ python-dotenv for .env loading)
#   3. Starts the FastAPI backend on :8001 — which auto-loads .env and
#      auto-connects/initialises the database from DATABASE_URL
#   4. Starts the Vite frontend on :8080
#   5. Health-checks both and confirms the DB is reachable
#
# Stop everything:  ./start.sh stop     (or: lsof -ti:8001,8080 | xargs kill -9)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/kpmg-intelliflow"           # nested Vite app
VENV="$ROOT/Intl"
ENV_FILE="$ROOT/.env"
BLOG="/tmp/intl_backend.log"
FLOG="/tmp/intl_frontend.log"

# ── stop mode ────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "stop" ]]; then
  echo "Stopping backend (:8001) and frontend (:8080)…"
  lsof -ti:8001,8080 2>/dev/null | xargs kill -9 2>/dev/null || true
  echo "Stopped."
  exit 0
fi

echo "▶ IntelliSource launcher"

# ── 0. PREFLIGHT: detect + validate toolchain BEFORE doing anything ──────────
echo "  Checking toolchain…"

# Python: prefer 3.12/3.11, then anything; require >= 3.10; warn on >= 3.13.
PY=""
for cand in python3.12 python3.11 python3.13 python3.10 python3; do
  if command -v "$cand" >/dev/null 2>&1; then PY="$cand"; break; fi
done
[[ -z "$PY" ]] && { echo "✗ No Python 3 found. Install Python 3.12 (brew install python@3.12)."; exit 1; }
PY_VER="$("$PY" -c 'import sys; print("%d.%d"%sys.version_info[:2])')"
PY_MAJ="${PY_VER%%.*}"; PY_MIN="${PY_VER##*.}"
echo "    • Python : $PY_VER  ($(command -v "$PY"))"
if (( PY_MAJ < 3 || (PY_MAJ == 3 && PY_MIN < 10) )); then
  echo "✗ Python $PY_VER too old — need 3.10+ (3.12 recommended)."; exit 1
fi
if (( PY_MAJ == 3 && PY_MIN >= 13 )); then
  echo "    ⚠ Python $PY_VER: pinned pandas/numpy may lack wheels — install may build from source or fail."
  echo "      Recommended: brew install python@3.12, then delete Intl/ and re-run."
fi

# Node + npm: required for the frontend; Node >= 18 (Vite 5 / React 19).
command -v node >/dev/null 2>&1 || { echo "✗ Node.js not found. Install Node 20 LTS (brew install node@20)."; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "✗ npm not found. Install Node 20 LTS."; exit 1; }
NODE_VER="$(node -v | sed 's/^v//')"
NODE_MAJ="${NODE_VER%%.*}"
echo "    • Node   : $NODE_VER  ($(command -v node))"
echo "    • npm    : $(npm -v)"
if (( NODE_MAJ < 18 )); then
  echo "✗ Node $NODE_VER too old — need 18+ (20 LTS recommended)."; exit 1
fi
echo "  Toolchain OK."

# ── 1. free the ports (restart-safe) ─────────────────────────────────────────
lsof -ti:8001,8080 2>/dev/null | xargs kill -9 2>/dev/null || true

# ── 2. create the "Intl" venv (reuse if present) ─────────────────────────────
if [[ ! -x "$VENV/bin/python" ]]; then
  echo "  Creating venv 'Intl' with Python $PY_VER…"
  "$PY" -m venv "$VENV"
else
  echo "  Reusing existing venv 'Intl' ($("$VENV/bin/python" -c 'import sys;print("%d.%d"%sys.version_info[:2])'))."
fi

PYBIN="$VENV/bin/python"
PIPBIN="$VENV/bin/pip"

# ── 3. install backend deps ──────────────────────────────────────────────────
echo "  Installing backend requirements…"
"$PYBIN" -m pip install --quiet --upgrade pip
if ! "$PIPBIN" install --quiet -r "$BACKEND/requirements.txt"; then
  echo "✗ Dependency install failed."
  echo "  Likely cause: pinned pandas/numpy have no wheel for $($PYBIN --version)."
  echo "  Fix: install Python 3.12 (brew install python@3.12), delete the Intl/ folder, re-run."
  exit 1
fi
"$PIPBIN" install --quiet python-dotenv   # so main.py loads .env cleanly

# ── 4. check .env (the DB credentials the backend auto-connects with) ─────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ No .env at repo root — the backend needs DATABASE_URL to connect. Aborting."
  exit 1
fi
if ! grep -q "^DATABASE_URL=." "$ENV_FILE"; then
  echo "✗ DATABASE_URL is empty in .env. Set it, then re-run."
  exit 1
fi
echo "  .env found — backend will auto-connect the database on startup."

# ── 5. start the backend (auto-loads .env, auto-inits the DB schema) ─────────
echo "  Starting backend on :8001…"
( cd "$BACKEND" && nohup "$VENV/bin/uvicorn" main:app --host 0.0.0.0 --port 8001 >"$BLOG" 2>&1 & )

# ── 6. start the frontend (npm install on first run) ─────────────────────────
if [[ ! -d "$FRONTEND/node_modules" ]]; then
  echo "  Installing frontend deps (first run)…"
  ( cd "$FRONTEND" && npm install --silent )
fi
echo "  Starting frontend on :8080…"
( cd "$FRONTEND" && nohup npm run dev >"$FLOG" 2>&1 & )

# ── 7. health-check both + confirm DB reachable ──────────────────────────────
echo -n "  Waiting for services"
db_ok=""; front_ok=""
for _ in $(seq 1 40); do
  # /api/chat/sessions returns 200 only if the backend AND its DB are up
  b=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/chat/sessions 2>/dev/null || true)
  f=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ 2>/dev/null || true)
  [[ "$b" == "200" ]] && db_ok=1
  { [[ "$f" == "200" || "$f" == "304" ]]; } && front_ok=1
  [[ -n "$db_ok" && -n "$front_ok" ]] && break
  echo -n "."; sleep 2
done
echo

echo "──────────────────────────────────────────────"
if [[ -n "$db_ok" ]]; then echo "✓ Backend + database  : http://localhost:8001  (DB connected)"
else echo "✗ Backend/DB not ready — check $BLOG"; fi
if [[ -n "$front_ok" ]]; then echo "✓ Frontend            : http://localhost:8080"
else echo "✗ Frontend not ready — check $FLOG"; fi
echo "──────────────────────────────────────────────"
echo "Logs : $BLOG | $FLOG"
echo "Stop : ./start.sh stop"
