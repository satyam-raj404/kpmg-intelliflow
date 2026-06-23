# IntelliSource — KPMG P2P Procurement Analytics

> AI-powered Procure-to-Pay analytics platform with live PostgreSQL access, process mining, and an agentic chatbot.

---

## What It Does

IntelliSource ingests SAP P2P data (POs, PRs, GRNs, Invoices, Payments, Vendors) and provides:

- **5 Dashboards** — Procurement, Financial, Leadership, Vendor Performance, Utilization
- **Profit Center Management** — CAPEX/OPEX classification per department × plant
- **Process Mining** — Anomaly detection: Split POs, Retro POs, Maverick Buying, Price Variances
- **AI Chatbot** — Ask anything in natural language; LLM queries live DB via tool calling (OpenRouter / GPT-4o)
- **P2P Lifecycle Tracker** — Full PR → PO → GRN → Invoice → Payment chain with cycle times

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + TanStack Router |
| State | TanStack Query + React Context |
| UI | Tailwind CSS + shadcn/ui + Recharts |
| Backend | FastAPI + Python 3.12 + uvicorn |
| Database | PostgreSQL 15 (psycopg3) |
| AI | OpenRouter API → GPT-4o |

---

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL 15 running on `localhost:5432`
- Database `intellisource` created

### 1. Create PostgreSQL database
```bash
psql -U postgres -c "CREATE DATABASE intellisource;"
```

### 2. Start Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Schema initializes automatically on first run (idempotent).

### 3. Start Frontend
```bash
cd kpmg-intelliflow
npm install
npm run dev
# → http://localhost:8080
```

### 4. Login
| Field | Value |
|-------|-------|
| Email | `admin` |
| Password | `12345678` |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:1234@localhost:5432/intellisource` | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | (bundled) | OpenRouter API key for chatbot |
| `CORS_ORIGINS` | — | Comma-separated extra allowed origins |

Create a `.env` file in the repo root to override defaults.

---

## Loading Data

Upload CSV files via the **Data Upload** page (sidebar → Operations → Data Upload).

Expected files (SAP exports):

| File | SAP Source | Table |
|------|-----------|-------|
| `01_PR_Dump.csv` | ME5A | `pr_dump` |
| `02_PO_Dump.csv` | ME2M | `po_dump` |
| `03_PO_Delivery_Dump.csv` | ME2M delivery | `po_delivery_dump` |
| `04_GRN_Dump.csv` | MB51 | `grn_dump` |
| `05_PO_Invoice_Dump.csv` | MIR6 | `po_invoice_dump` |
| `06_Invoice_Dump.csv` | FBL1N | `invoice_dump` |
| `07_Payment_Dump.csv` | F110 | `payment_dump` |
| `08_Vendor_Master.csv` | XK03 | `vendor_master` |
| `09_Change_Log.csv` | CDHDR | `change_log` |

After upload, the system automatically:
1. Parses and validates columns
2. Loads to PostgreSQL
3. Builds `pr_po_grn_invoice` fact table
4. Runs process mining (anomaly detection)
5. Recomputes all KPIs

---

## Project Structure

```
kpmg-intelliflow/
├── backend/                    # FastAPI backend
│   ├── main.py                 # App entry point
│   ├── database.py             # PostgreSQL connection (psycopg3)
│   ├── schema.sql              # DDL + seed data
│   ├── routers/                # API endpoint handlers
│   │   ├── auth.py             # Authentication + user management
│   │   ├── kpi.py              # KPI fetch + recompute
│   │   ├── chat.py             # AI chat session management
│   │   ├── profit_center.py    # Profit Center CRUD
│   │   ├── p2p.py              # P2P lifecycle queries
│   │   ├── events.py           # Process mining anomalies
│   │   ├── upload.py           # CSV upload + ETL trigger
│   │   └── actions.py          # Action log
│   └── services/
│       ├── chat_engine.py      # OpenRouter agentic loop
│       ├── chat_tools.py       # LLM tool executors
│       ├── kpi_engine.py       # KPI computation (80+ formulas)
│       ├── fact_builder.py     # P2P fact table builder
│       └── event_generator.py  # Anomaly detection engine
├── kpmg-intelliflow/           # React frontend
│   └── src/
│       ├── routes/             # Page components
│       ├── components/         # Shared UI components
│       ├── context/            # AppContext (global state)
│       └── api/                # API client + TanStack Query hooks
├── data/                       # Sample CSV data files
├── TECHNICAL_DOCUMENTATION.md  # Full technical reference
├── SAP_FUNCTIONAL_DOCUMENTATION.md  # SAP field mapping + KPI queries
└── README.md
```

---

## AI Chatbot

The chatbot uses an **agentic loop** — GPT-4o decides which tools to call, queries the live database, then synthesizes a natural language answer.

**Available tools:**
- `query_database` — custom SQL SELECT
- `get_kpis` — pre-computed dashboard KPIs
- `find_document` — full P2P chain for any PO/PR/GRN/Invoice number
- `get_anomalies` — process mining summary
- `get_vendor_info` — vendor spend + status
- `get_p2p_stage_summary` — average cycle times

**Sample questions:**
- "What is total CAPEX spend this month by company code?"
- "Show all POs for vendor 100001 and their payment status"
- "Which departments have the highest maverick buying?"
- "Tell me about PO 2000001004 — is it fully invoiced?"

---

## Roles

| Role | Access |
|------|--------|
| Admin | Full access including User Management |
| Procurement Manager | All dashboards + operations |
| Finance User | Financial + Procurement dashboards |
| CXO / Leadership / Director | Leadership dashboard + read-only |
| Compliance Officer | Anomalies + audit trail |
| Delivery Manager / Manager | Operations tabs |
| Partner / Consultant / Associate Director | Read-only dashboards |

---

## Documentation

| Document | Description |
|----------|-------------|
| [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) | Architecture, API reference, DB schema, design decisions |
| [SAP_FUNCTIONAL_DOCUMENTATION.md](SAP_FUNCTIONAL_DOCUMENTATION.md) | SAP field mapping, KPI SQL queries, CAPEX/OPEX logic, integration roadmap |

---

## License

Internal use — KPMG India. Not for public distribution.
