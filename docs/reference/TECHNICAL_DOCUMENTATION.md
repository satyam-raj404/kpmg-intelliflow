# IntelliSource — Technical Documentation

> KPMG P2P Procurement Analytics Platform
> Version: 1.0 | Stack: FastAPI + PostgreSQL + React + TanStack Router

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (Port 8081)                 │
│   React 18 + TypeScript + Vite + TanStack Router         │
│   TanStack Query · Recharts · Tailwind CSS · shadcn/ui   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / fetch
┌────────────────────────▼────────────────────────────────┐
│              FastAPI Backend (Port 8001)                  │
│   Python 3.12 · uvicorn --reload · CORS configured       │
│   Routers: auth, kpi, p2p, upload, events, actions,      │
│            chat, profit_center                            │
└────────────────────────┬────────────────────────────────┘
                         │ psycopg3
┌────────────────────────▼────────────────────────────────┐
│             PostgreSQL (localhost:5432)                   │
│             Database: intellisource                       │
│   Tables: po_dump, pr_dump, grn_dump, po_invoice_dump,   │
│           payment_dump, vendor_master, pr_po_grn_invoice, │
│           process_mining_events, kpi_results,             │
│           profit_center_master, users, audit_log,         │
│           kpi_config, po_categorization                   │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│               OpenRouter API (External)                   │
│   Model: openai/gpt-4o                                    │
│   Endpoint: https://openrouter.ai/api/v1/chat/completions │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Backend Structure

```
backend/
├── main.py                  # FastAPI app, lifespan, CORS, router registration
├── database.py              # PostgreSQL connection pool, _PGConnection wrapper
├── schema.sql               # DDL + seed data (idempotent)
├── requirements.txt
├── routers/
│   ├── auth.py              # Login, register, sessions, user CRUD
│   ├── kpi.py               # KPI fetch, recompute trigger
│   ├── p2p.py               # P2P lifecycle queries
│   ├── upload.py            # CSV upload, ETL trigger
│   ├── events.py            # Process mining anomaly endpoints
│   ├── actions.py           # Action log CRUD
│   ├── chat.py              # Chat session management, /api/chat
│   └── profit_center.py     # Profit Center CRUD + CAPEX/OPEX cascade
└── services/
    ├── chat_engine.py        # OpenRouter agentic loop, tool orchestration
    ├── chat_tools.py         # Tool executors (SQL, KPI, doc lookup, etc.)
    ├── kpi_engine.py         # KPI computation formulas (all dashboards)
    ├── etl.py                # CSV → DB parsing and loading
    ├── fact_builder.py       # Builds pr_po_grn_invoice fact table
    ├── event_generator.py    # Process mining anomaly detection
    ├── parser.py             # Column name normalizer for uploaded CSVs
    ├── loader.py             # Bulk insert helper
    └── validator.py          # Upload validation rules
```

---

## 3. Database Layer (`database.py`)

### Connection Model
- **`_PGConnection`** wraps `psycopg3` connection with `sqlite3`-compatible interface
- `?` placeholder in SQL auto-replaced with `%s` for psycopg3 compatibility
- Each HTTP worker thread gets its own connection via `threading.local()`
- `SAVEPOINT` used per-statement — a failed query doesn't abort the transaction

### `HybridRow`
Dict subclass that supports both:
- `row["column_name"]` — dict access
- `row[0]` — positional access (sqlite3 compat)

### Connection String
```
postgresql://postgres:1234@localhost:5432/intellisource
```
Override via `DATABASE_URL` environment variable.

### `init_db()`
Reads `schema.sql`, splits on `;`, executes each statement at startup. Runs every `uvicorn --reload`. All DDL must be idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`).

---

## 4. API Routers

### `auth.py` — `/api/auth`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Plain-text password match, returns user + role |
| POST | `/auth/register` | Create new user (12 valid roles enforced) |
| POST | `/auth/logout` | Log session event |
| GET | `/auth/sessions` | Recent login/logout events |
| GET | `/auth/users` | List all users (admin) |
| PUT | `/auth/users/{user_id}` | Update role or active status |

**Valid Roles:** `Procurement Manager`, `Delivery Manager`, `Finance User`, `Compliance Officer`, `CXO`, `Admin`, `Leadership`, `Partner`, `Consultant`, `Manager`, `Director`, `Associate Director`

**Auth model:** Plain-text password stored in `users.password`. No JWT — session events tracked in `audit_log`.

---

### `kpi.py` — `/api/kpis`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/kpis` | Fetch all KPI results (dashboard + company_code filter) |
| POST | `/kpis/compute` | Trigger full KPI recomputation for all companies |

KPIs stored in `kpi_results` table. Recomputed via `kpi_engine.py` which runs 80+ SQL queries across all dashboards and company codes.

---

### `profit_center.py` — `/api/profit-centers`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profit-centers` | List all active PCs with actual spend (JOIN po_dump) |
| POST | `/profit-centers` | Create new profit center |
| PUT | `/profit-centers/{pc_code}` | Update name/budget/flag (cascades to po_categorization) |
| DELETE | `/profit-centers/{pc_code}` | Soft-deactivate (sets is_active=0) |

**CAPEX/OPEX cascade logic:**
When `default_capex_opex` flag is changed via PUT, it cascades to `po_categorization` table **only for rows where `tagged_by = 'SYSTEM'`** — manual user tags are never overwritten.

---

### `chat.py` — `/api/chat`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat` | Send message, get AI reply |
| DELETE | `/chat/session/{sid}` | Clear session history |

Session history stored in-memory dict `_sessions`. Rolling 20-message window.

---

### `p2p.py` — `/api/p2p`

Provides P2P lifecycle queries: full chain per PO, stage-wise document counts, pending PR/PO/GRN counts.

---

### `events.py` — `/api/events`

Returns process mining anomaly data from `process_mining_events` table. Anomaly flags per PO.

---

### `upload.py` — `/api/upload`

Accepts CSV files for all 9 data tables. Triggers ETL pipeline: parse → validate → load → fact_build → event_generate → kpi_compute.

---

## 5. AI Chatbot Architecture (`chat_engine.py`)

### Model
- **Provider:** OpenRouter
- **Model:** `openai/gpt-4o`
- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Max tokens:** 2048

### Agentic Loop

```python
run_chat(user_message, history)
│
├── Build messages: [SYSTEM_PROMPT] + history + [user_message]
│
├── Loop (max 8 iterations):
│   ├── _openrouter_call(messages)
│   │   ├── finish_reason == "tool_calls"
│   │   │   ├── _enforce_limit(sql)        ← inject LIMIT 20 if missing
│   │   │   ├── _execute_tool(name, args)  ← call tool function
│   │   │   └── _compress_result(result)   ← compress to ≤20 rows
│   │   └── finish_reason == "stop" → return reply
│
└── return { reply, tools_used, new_history }
```

### Context Compression Layers

**`_enforce_limit(sql)`**
Appends `LIMIT 20` to any SQL query that lacks a LIMIT clause. Prevents large table dumps from flooding the context window.

**`_compress_result(result)`**
- **Lists:** Keeps top 20 rows. Appends `[TRUNCATED: showing 20 of N rows]` if more exist.
- **Dicts:** Truncates string values > 400 chars to `value[:400]…`
- **Fallback:** Hard cap at 3000 characters.

### Tools Available to the LLM

| Tool | Description |
|------|-------------|
| `query_database(sql)` | Read-only SELECT. Write ops blocked by regex. Returns list of dicts. |
| `get_kpis(dashboard, company_code)` | Pre-computed KPIs from `kpi_results` table. |
| `find_document(doc_type, doc_number)` | Full P2P chain for PO/PR/GRN/Invoice. |
| `get_anomalies()` | Anomaly flag breakdown from `process_mining_events`. |
| `get_vendor_info(vendor_id?)` | Vendor spend, PO count, MSME flag. Top 20 if no ID given. |
| `get_p2p_stage_summary()` | Avg cycle days per stage (PR→PO→GRN→Invoice→Payment). |

---

## 6. KPI Engine (`kpi_engine.py`)

Computes 80+ KPIs across 5 dashboards. All formulas reference the IntelliSource P2P Reference Schema.

### Dashboards

| Dashboard | Code Prefix | KPI Count |
|-----------|-------------|-----------|
| Procurement | P1–P20 | 20 |
| Financial | F1–F15 | 15 |
| Leadership | L1–L12 | 12 |
| Vendor | V1–V15 | 15 |
| Utilization | U1–U20 | 20 |

### Key Design Patterns

```sql
-- Active PO filter (standard across all queries)
WHERE deletion_indicator NOT IN ('L', 'X')

-- Safe numeric cast (net_order_value stored as TEXT)
CAST(COALESCE(NULLIF(net_order_value, ''), '0') AS REAL)

-- Fiscal Year: April 1 (Indian FY)
fy_start = year-04-01

-- ROUND with psycopg3 requires ::numeric cast
ROUND(AVG(col::numeric), 1)
```

### Multi-company Support
Each KPI computed for ALL + each individual company code (1001, 1002, 1003). Stored with `company_code` dimension in `kpi_results`.

---

## 7. Frontend Structure

```
kpmg-intelliflow/src/
├── routes/
│   ├── login.tsx            # Login page (text input, accepts non-email usernames)
│   ├── signup.tsx           # Registration, calls POST /auth/register
│   ├── dashboard.tsx        # Procurement dashboard
│   ├── financial.tsx        # Financial dashboard
│   ├── leadership.tsx       # Leadership dashboard
│   ├── vendors.tsx          # Vendor performance dashboard
│   ├── utilization.tsx      # Utilization dashboard (dept filter, donut chart)
│   ├── profit-center.tsx    # Profit Center CRUD table
│   ├── p2p.tsx              # P2P lifecycle timeline
│   ├── ask.tsx              # AI chatbot (10 quick prompts)
│   ├── upload.tsx           # CSV data upload
│   ├── actions.tsx          # Action log
│   └── admin.users.tsx      # User management (admin only)
├── components/
│   ├── Sidebar.tsx          # Navigation (logo links to /login)
│   ├── TopBar.tsx           # Period selector, company filter, sign out
│   ├── AppShell.tsx         # Layout wrapper
│   └── PageHeader.tsx       # Page title + subtitle
├── context/
│   └── AppContext.tsx       # Global state: user, role, period, company
├── api/
│   ├── client.ts            # apiFetch() wrapper
│   ├── queries.ts           # TanStack Query fetchers
│   └── types.ts             # TypeScript interfaces
└── lib/
    └── utils.ts             # cn() and helpers
```

---

## 8. State Management

- **Global:** `AppContext` (React Context) — `user`, `role`, `period`, `company`
- **Server state:** TanStack Query (`useQuery`, `useMutation`, `queryClient.invalidateQueries`)
- **Persistence:** `localStorage` key `intellisource_user_profile` — restored on page reload
- **Session reset:** On sign-out, `DEFAULT_PROFILE` restored, localStorage cleared, navigate to `/login`

---

## 9. Data Tables

| Table | Source | Description |
|-------|--------|-------------|
| `po_dump` | MM module / ME2M | Purchase Orders with line items |
| `pr_dump` | MM module / ME5A | Purchase Requisitions |
| `grn_dump` | MM / MIGO | Goods Receipt Notes |
| `po_invoice_dump` | FI / MIR7 | PO-based Invoices |
| `payment_dump` | FI / F110 | Payment documents |
| `vendor_master` | XK03 | Vendor master with MSME flag |
| `pr_po_grn_invoice` | Computed | P2P fact table (cycle times, amounts) |
| `process_mining_events` | Computed | Anomaly flags per PO |
| `kpi_results` | Computed | Pre-aggregated KPI values |
| `profit_center_master` | Manual | PC → dept × plant × material_group mapping |
| `po_categorization` | User/System | CAPEX/OPEX tagging per PO |
| `users` | Auth | User accounts |
| `audit_log` | System | Login/action audit trail |
| `kpi_config` | Config | FY start, thresholds, company codes |

---

## 10. Environment & Startup

### Start Backend
```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Start Frontend
```bash
cd kpmg-intelliflow
npm run dev
# Runs on port 8080 (fallback to 8081 if busy)
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:1234@localhost:5432/intellisource` | PostgreSQL DSN |
| `OPENROUTER_API_KEY` | (hardcoded fallback) | OpenRouter API key |
| `CORS_ORIGINS` | — | Comma-separated extra CORS origins |

### Admin Credentials
- **Email:** `admin`
- **Password:** `12345678`

---

## 11. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Plain-text passwords | Simplicity — security not primary concern in current phase |
| `?` → `%s` SQL translation | sqlite3-style code works against psycopg3 without rewrite |
| `SAVEPOINT` per statement | Failed queries don't abort the whole transaction |
| `HybridRow` dict+index | Legacy code uses both `row[0]` and `row["col"]` access patterns |
| KPI pre-computation | Dashboard loads are instant; recompute triggered on data upload |
| Client-side dept filter | Utilization dept filter uses pre-loaded KPI JSON, no extra API call |
| `tagged_by='SYSTEM'` on CAPEX/OPEX cascade | Protects manual user categorizations from bulk flag changes |
| Rolling 20-message chat history | Balances context continuity vs. token cost |
