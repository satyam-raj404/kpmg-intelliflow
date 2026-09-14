#!/usr/bin/env python3
"""
IntelliSource — KPMG server launcher (Python, Windows-friendly)

start.sh assumes a bash environment (venv at bin/, lsof, clipboard tools) that
the KPMG server doesn't have. This does the same job with only the stdlib, so
it runs under any Python already on the box:

    python init_kpmg.py            set up + launch everything, health-check
    python init_kpmg.py stop       stop backend + frontend
    python init_kpmg.py logs       print recent backend + frontend log tails

Or just double-click start_kpmg.bat, which calls this.

What it does:
  1. Creates a venv named "Intl" (reused if already there)
  2. Installs backend/requirements.txt (+ python-dotenv)
  3. Writes a default .env (postgres/1234) if one isn't already present
  4. Ensures the `intellisource` Postgres database exists (CREATE DATABASE if
     missing) — the actual tables are created by the backend itself on
     startup, same as before
  5. Starts the FastAPI backend on :8001
  6. Installs frontend deps (npm install, first run only) and starts the Vite
     frontend on :8080
  7. Health-checks both and reports status

AI features (Ask IntelliSource) run with whatever OPENROUTER_API_KEY is in
.env. Leave it blank (the default) and the feature stays visible in the UI
but greys out with a clear message instead of crashing — see
backend/services/agent/config.py:ai_enabled().
"""
import json
import os
import platform
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# Windows consoles default to a legacy codepage (cp1252/cp437) that can't
# encode the ✓/✗/▶ etc. used below — a bare print() of them crashes with
# UnicodeEncodeError before anything useful runs. Force UTF-8 on stdout/err;
# reconfigure() exists on Python 3.7+'s TextIOWrapper.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = ROOT / "Intl"
ENV_FILE = ROOT / ".env"
LOG_DIR = ROOT / "logs"
PID_FILE = ROOT / ".kpmg_pids.json"

IS_WINDOWS = platform.system() == "Windows"
VENV_PY = VENV / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")
VENV_UVICORN = VENV / ("Scripts/uvicorn.exe" if IS_WINDOWS else "bin/uvicorn")
NPM = "npm.cmd" if IS_WINDOWS else "npm"

BLOG = LOG_DIR / "backend.log"
FLOG = LOG_DIR / "frontend.log"

DEFAULT_ENV = """DATABASE_URL=postgresql://postgres:1234@localhost:5432/intellisource
OPENROUTER_API_KEY=
"""


def log(msg: str) -> None:
    print(msg, flush=True)


def die(msg: str) -> None:
    log(f"✗ {msg}")
    sys.exit(1)


# ── stop / logs modes ─────────────────────────────────────────────────────────

def _read_pids() -> dict:
    if not PID_FILE.exists():
        return {}
    try:
        return json.loads(PID_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def cmd_stop() -> None:
    pids = _read_pids()
    if not pids:
        log("No tracked processes (nothing to stop). If ports are still busy, kill manually.")
        return
    for name, pid in pids.items():
        log(f"Stopping {name} (PID {pid})...")
        try:
            if IS_WINDOWS:
                subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"],
                                capture_output=True)
            else:
                os.kill(pid, 9)
        except (OSError, ProcessLookupError) as exc:
            log(f"  (already stopped: {exc})")
    PID_FILE.unlink(missing_ok=True)
    log("Stopped.")


def cmd_logs() -> None:
    for name, path in (("backend", BLOG), ("frontend", FLOG)):
        log(f"--- {name} (tail) ---")
        if path.exists():
            lines = path.read_text(errors="replace").splitlines()
            log("\n".join(lines[-30:]))
        else:
            log("(no log yet)")
        log("")


# ── preflight ──────────────────────────────────────────────────────────────

def check_toolchain() -> None:
    log("  Checking toolchain...")
    py_ver = "%d.%d" % sys.version_info[:2]
    log(f"    - Python : {py_ver} ({sys.executable})")
    if sys.version_info < (3, 10):
        die(f"Python {py_ver} too old — need 3.10+.")

    import shutil
    node = shutil.which("node")
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not node:
        die("Node.js not found. Install Node 20 LTS.")
    if not npm:
        die("npm not found. Install Node 20 LTS.")
    node_ver = subprocess.run([node, "-v"], capture_output=True, text=True).stdout.strip().lstrip("v")
    log(f"    - Node   : {node_ver} ({node})")
    if node_ver and int(node_ver.split(".")[0]) < 18:
        die(f"Node {node_ver} too old — need 18+.")
    log("  Toolchain OK.")


def ensure_venv() -> None:
    if VENV_PY.exists():
        log("  Reusing existing venv 'Intl'.")
        return
    log("  Creating venv 'Intl'...")
    subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)


def install_backend_deps() -> None:
    log("  Installing backend requirements...")
    # Always go through "python -m pip", never the Scripts/pip.exe shim directly —
    # that shim goes missing if pip's own install gets corrupted (seen on the KPMG
    # box as a "WARNING: Ignoring invalid distribution ~ip" — an AV-mangled pip
    # dist-info), even though the pip package itself, and -m pip, still work.
    subprocess.run([str(VENV_PY), "-m", "pip", "install", "--quiet", "--upgrade", "pip"], check=True)
    result = subprocess.run(
        [str(VENV_PY), "-m", "pip", "install", "--quiet", "-r", str(BACKEND / "requirements.txt")]
    )
    if result.returncode != 0:
        die("Backend dependency install failed — check the pinned versions support your Python.")
    subprocess.run([str(VENV_PY), "-m", "pip", "install", "--quiet", "python-dotenv"], check=True)


def ensure_env_file() -> dict:
    if not ENV_FILE.exists():
        log("  No .env found — writing default (postgres/1234, no AI key).")
        ENV_FILE.write_text(DEFAULT_ENV)
    else:
        log("  .env found — leaving as-is.")

    env_vars: dict = {}
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env_vars[key.strip()] = value.strip()
    return env_vars


def ensure_database(env_vars: dict) -> None:
    log("  Ensuring database exists...")
    proc_env = os.environ.copy()
    proc_env.update(env_vars)
    result = subprocess.run(
        [str(VENV_PY), str(BACKEND / "scripts" / "ensure_db.py")],
        env=proc_env,
    )
    if result.returncode != 0:
        die("Could not verify/create the database — is Postgres running with the configured credentials?")


def start_backend(env_vars: dict) -> subprocess.Popen:
    log("  Starting backend on :8001...")
    LOG_DIR.mkdir(exist_ok=True)
    proc_env = os.environ.copy()
    proc_env.update(env_vars)
    # Without this, uvicorn's own Python process inherits Windows' legacy
    # console codepage and mangles any non-ASCII print() in backend code
    # (seed.py's em-dashes show up as "�" in logs/backend.log otherwise).
    proc_env["PYTHONUTF8"] = "1"
    proc_env["PYTHONIOENCODING"] = "utf-8"
    with open(BLOG, "w") as f:
        kwargs = {}
        if IS_WINDOWS:
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        proc = subprocess.Popen(
            [str(VENV_UVICORN), "main:app", "--host", "0.0.0.0", "--port", "8001"],
            cwd=str(BACKEND), stdout=f, stderr=subprocess.STDOUT, env=proc_env, **kwargs,
        )
    return proc


def start_frontend() -> subprocess.Popen:
    if not (FRONTEND / "node_modules").exists():
        log("  Installing frontend deps (first run)...")
        subprocess.run([NPM, "install", "--silent"], cwd=str(FRONTEND), check=True)
    log("  Starting frontend on :8080...")
    with open(FLOG, "w") as f:
        kwargs = {}
        if IS_WINDOWS:
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        proc = subprocess.Popen(
            [NPM, "run", "dev"], cwd=str(FRONTEND), stdout=f, stderr=subprocess.STDOUT, **kwargs,
        )
    return proc


def lan_ip() -> str:
    """Best-effort LAN IP — used only to print a URL others on the network
    can use; doesn't actually send anything (UDP socket, no connect)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "localhost"
    finally:
        s.close()


def _http_ok(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:
            return resp.status in (200, 304)
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        return False


def wait_for_services() -> tuple[bool, bool]:
    log("  Waiting for services", )
    db_ok = front_ok = False
    for _ in range(40):
        if not db_ok:
            db_ok = _http_ok("http://localhost:8001/api/chat/sessions")
        if not front_ok:
            front_ok = _http_ok("http://localhost:8080/")
        if db_ok and front_ok:
            break
        print(".", end="", flush=True)
        time.sleep(2)
    print()
    return db_ok, front_ok


def cmd_start() -> None:
    log("▶ IntelliSource launcher (KPMG server)")
    check_toolchain()
    ensure_venv()
    install_backend_deps()
    env_vars = ensure_env_file()
    ensure_database(env_vars)

    backend_proc = start_backend(env_vars)
    frontend_proc = start_frontend()
    PID_FILE.write_text(json.dumps({"backend": backend_proc.pid, "frontend": frontend_proc.pid}))

    db_ok, front_ok = wait_for_services()

    ip = lan_ip()
    log("-" * 48)
    if db_ok:
        log(f"✓ Backend + database  : http://localhost:8001  (DB connected)  |  LAN: http://{ip}:8001")
    else:
        log(f"✗ Backend/DB not ready — check {BLOG}")
    if front_ok:
        log(f"✓ Frontend            : http://localhost:8080  |  LAN: http://{ip}:8080")
    else:
        log(f"✗ Frontend not ready — check {FLOG}")
    log("-" * 48)
    log(f"Other machines on the network can reach the app at http://{ip}:8080")
    log("(Windows may prompt to allow Python/Node through the firewall the first time — allow it.)")
    log(f"Logs : {BLOG} | {FLOG}   (view: python init_kpmg.py logs)")
    log("Stop : python init_kpmg.py stop")

    if not env_vars.get("OPENROUTER_API_KEY"):
        log("\nNote: OPENROUTER_API_KEY is not set — Ask IntelliSource AI features")
        log("      will show in the UI but stay disabled until a key is added to .env.")

    if not (db_ok and front_ok):
        log("\nOne or more services didn't start — see logs above.")
        sys.exit(1)


def main() -> None:
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "stop":
        cmd_stop()
    elif arg == "logs":
        cmd_logs()
    elif arg == "":
        cmd_start()
    else:
        die(f"Unknown command {arg!r}. Use: (none) | stop | logs")


if __name__ == "__main__":
    main()
