# IntelliSource — Complete Application Context
**KPMG India | P2P Intelligence and Analytics Platform**  
Version: 1.0 | Date: Jul 2026 | Classification: Internal Reference

---

## 1. Product Identity

| Field | Detail |
|---|---|
| **Product Name** | KPMG IntelliSource |
| **Full Name** | IntelliSource — P2P Intelligence and Analytics Platform |
| **Owner** | KPMG India — Advisory / Consulting Practice |
| **Status** | Live (Pilot — Internal KPMG use, Jan–Jun 2026) |
| **Classification** | Internal Analytics Tool — Supporting Technology Solution |
| **Domain** | Procure-to-Pay (P2P) / Source-to-Pay (S2P) |

---

## 2. The Problem IntelliSource Solves

### Current State Pain Points (As-Is)

Large enterprises running SAP ECC / S4HANA for procurement have significant visibility gaps:

1. **No real-time P2P visibility** — all analytics are retrospective (T+5 to T+10 days after month-end)
2. **Manual data extraction** — procurement teams run SAP standard reports (ME2M, MB52, FBL1N), export to Excel, build pivot tables manually
3. **Disconnected views** — procurement, finance, vendor management tracked in separate spreadsheets with no single version of truth
4. **Reactive anomaly detection** — Maverick buys, duplicate invoices, split POs found only during internal audits, not in real time
5. **No CAPEX/OPEX automated split** — manual classification effort per period
6. **No AI query interface** — SQL expertise required for ad-hoc analysis; leadership cannot self-serve
7. **Stale leadership reporting** — CXOs receive emailed reports 5–10 days after period close, with no drill-down capability
8. **SOD violations not monitored** — segregation-of-duty conflicts caught in audit only

### Business Impact of the Gap

- Maverick spend (non-PO purchases) averaging 15–25% of total spend at typical enterprises
- Duplicate invoice payments consuming 0.1–0.5% of AP volume
- P2P cycle times 3–5× longer than best-in-class due to manual coordination
- Audit findings on procurement controls — reputational and financial exposure

---

## 3. What IntelliSource Does

IntelliSource is a **real-time P2P analytics and intelligence platform** that transforms raw SAP procurement data into actionable insights across 5 role-specific dashboards, with an embedded AI assistant.

### Core Value Proposition

> "From SAP data to strategic decision — in minutes, not months."

- Ingests 9 types of SAP CSV exports (PR, PO, GRN, Invoice, Payment, Vendor Master, Change Log, PO Delivery, PO Invoice)
- Computes 45+ procurement KPIs automatically — updated on every data upload
- Detects 12 categories of procurement anomalies and control failures in real time
- Provides a natural-language AI assistant that answers procurement questions from live data
- Serves 12 user roles with tailored views — from Procurement Manager to CXO

---

## 4. The 5 Dashboards

### 4.1 Procurement Dashboard
**Users:** Procurement Manager, Admin  
**Purpose:** Monitor end-to-end PO lifecycle and procurement efficiency

Key KPIs:
- Total PO Value (MTD / YTD / FY)
- Active Purchase Orders count
- Open PR Aging (PRs not yet converted to POs, by days bucket)
- PO Approval Cycle Time (days from PR creation to PO release)
- PO Amendment Rate (% of POs changed after release)
- PR-to-PO Conversion Rate
- On-Time Delivery Rate
- PO vs PR Value Variance
- Retro PO Rate (POs raised after GRN)

### 4.2 Financial Dashboard
**Users:** Finance User, AP Team, Compliance Officer  
**Purpose:** Monitor financial performance of the P2P cycle

Key KPIs:
- Total Payments YTD
- 3-Way Match Rate (PO–GRN–Invoice alignment)
- Invoice Processing Days
- On-Time Payment Rate
- Early Payment Rate (Discount Capture Rate)
- CAPEX vs OPEX Split (auto-classified from SAP data)
- Duplicate Invoice Detection Rate
- Payment Before GRN Rate

### 4.3 Vendor Dashboard
**Users:** Procurement Manager, Compliance Officer  
**Purpose:** Assess and compare vendor performance

Key KPIs:
- Vendor Count (active, blocked, MSME-flagged)
- Vendor Spend Concentration (Top 5 / Top 10 vendor spend %)
- Vendor On-Time Delivery Rate by vendor
- Vendor Invoice Accuracy Rate
- Blocked Vendor Order Attempts
- MSME Compliance Rate
- Vendor Health Breakdown (performance scoring)

### 4.4 Leadership Dashboard
**Users:** CXO, Leadership, Partner, Director, Associate Director, Manager, Consultant  
**Purpose:** Strategic procurement intelligence for executive decision-making

Key KPIs:
- Total Procurement Spend (YTD)
- Maverick Spend Rate (% purchases without valid PO)
- P2P Process Risk Score (composite)
- Vendor Concentration Risk
- Top Vendor Spend Breakdown
- Procurement Savings vs Budget
- P2P Cycle Time — end-to-end average
- P2P Summary Counts (PR, PO, GRN, Invoice, Payment totals)

### 4.5 Utilization Dashboard
**Users:** Finance User, Delivery Manager  
**Purpose:** Capital expenditure tracking and budget utilization

Key KPIs:
- CAPEX vs OPEX Actual Spend
- Budget Utilization Rate
- CAPEX Burn Rate by Cost Center / Profit Center
- OPEX Run Rate
- Under/Over-utilized Budget Lines

---

## 5. AI Assistant — Ask IntelliSource

**Technology:** GPT-4o via OpenRouter API  
**Interface:** Natural language chat embedded in `/ask` route  

Users can ask questions like:
- "Which vendors have the highest payment delays this quarter?"
- "What is our maverick spend rate for Bangalore this month?"
- "Show me the top 5 POs by value that haven't received GRN"
- "Compare CAPEX utilization across all profit centers"

The AI executes up to 3 database tool calls per response, querying live PostgreSQL data, and returns plain-English answers with supporting data.

**6 Tool Definitions:**
1. `query_database` — raw SQL execution for custom queries
2. `get_kpis` — fetch pre-computed KPI values from kpi_results
3. `find_document` — locate specific PO/Invoice/PR by number
4. `get_anomalies` — retrieve anomaly flags for a vendor or PO set
5. `get_vendor_info` — vendor master + performance summary
6. `get_p2p_stage_summary` — lifecycle stage breakdown for a time period

---

## 6. Anomaly Detection Engine

12 procurement anomaly categories automatically classified on each data upload:

| Anomaly | Description |
|---|---|
| MAVERICK_BUY | Purchase without valid approved PO |
| DUPLICATE_INVOICE | Same invoice submitted multiple times |
| SPLIT_PO | Single large PO split into multiple smaller POs to avoid approval thresholds |
| PRICE_DEVIATION | Invoice price deviates significantly from PO net price |
| THREE_WAY_MISMATCH | PO–GRN–Invoice quantities or values do not reconcile |
| GRN_WITHOUT_PO | Goods received with no corresponding purchase order |
| PAYMENT_BEFORE_GRN | Payment made before goods/services confirmed received |
| LATE_DELIVERY | Vendor delivery beyond scheduled delivery date |
| VENDOR_BLOCK | Order placed against centrally blocked vendor |
| RETRO_PO | Purchase order raised after GRN already posted |
| DELETED_AFTER_GRN | PO deleted after goods receipt — audit red flag |
| SOD_CONFLICT | Segregation of duty violation (requester = approver, etc.) |

---

## 7. Technical Architecture

### 7.1 Frontend
| Component | Technology |
|---|---|
| Language | TypeScript 5.x |
| Framework | React 18.x |
| Build Tool | Vite 5.x |
| Routing | TanStack Router v1 (file-based, type-safe) |
| Server State | TanStack Query v5 |
| UI Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS v3 |
| Charts | Recharts 2.x |
| Animation | Framer Motion |
| Package Manager | Bun 1.x |
| Hosting | Vercel CDN (global edge) |

### 7.2 Backend
| Component | Technology |
|---|---|
| Language | Python 3.11+ |
| Framework | FastAPI |
| Server | Uvicorn (ASGI) |
| DB Driver | psycopg3 (thread-local pool, 8 connections) |
| Excel Export | openpyxl |
| HTTP Client | httpx |
| Hosting | Cloud VM → Azure Container Apps (Target) |

### 7.3 Database
| Component | Technology |
|---|---|
| Engine | PostgreSQL 15+ |
| Pilot Hosting | Neon Serverless PostgreSQL |
| Target Hosting | Azure Database for PostgreSQL Flexible Server |
| Tables | 14 application tables |
| Key Fact Table | pr_po_grn_invoice — denormalised P2P lifecycle fact |
| KPI Store | kpi_results — 45 KPIs, 5 dashboards |

### 7.4 AI Layer
| Component | Technology |
|---|---|
| Provider | OpenRouter API (openrouter.ai) |
| Model | GPT-4o (openai/gpt-4o) |
| Pattern | Agentic tool loop — max 3 tool calls per response |

### 7.5 API Surface
8 FastAPI routers:
- `/api/upload` — CSV ingestion and ETL
- `/api/kpi` — KPI engine reads
- `/api/p2p` — P2P lifecycle analytics
- `/api/events` — Process mining and anomaly detection
- `/api/actions` — Remediation action tracking
- `/api/auth` — Authentication and user management
- `/api/chat` — AI assistant engine
- `/api/profit_center` — Profit center master data

---

## 8. Data Model

### 8.1 Source Tables (from SAP CSV uploads)
| Table | Source SAP Object | Key Fields |
|---|---|---|
| po_dump | ME2M / EKKO+EKPO | purchasing_document, vendor, net_order_value, capex_opex_flag |
| pr_dump | ME5A / EBAN | purchase_requisition, requisitioner, release_status |
| grn_dump | MB51 / MSEG | material_document, movement_type, amount_local_ccy |
| po_delivery_dump | ME2M delivery schedule | expected_delivery_date, scheduled_quantity |
| po_invoice_dump | MIR4 / RSEG | invoice_doc, purchasing_document, amount_local_ccy |
| invoice_dump | FBL1N / BKPF+BSEG | invoice_doc, vendor, due_date, clearing_doc |
| payment_dump | FBL1N payment lines | payment_doc, clearing_date, payment_method |
| vendor_master | LFA1+LFB1 | vendor, vendor_name, msme_flag, central_purchasing_block |
| change_log | CDHDR+CDPOS | object_id, field_name, old_value, new_value, username |

### 8.2 Computed / Analytics Tables
| Table | Purpose |
|---|---|
| pr_po_grn_invoice | Denormalised P2P fact: cycle times, is_maverick flag, CAPEX/OPEX |
| kpi_results | 45 KPI values per dashboard, company code, computed_at timestamp |
| process_mining_events | Anomaly flags and variant class per PO |

### 8.3 Platform Tables
| Table | Purpose |
|---|---|
| users | User accounts — email, role, is_active |
| audit_log | All user actions — LOGIN, DATA_UPLOAD, USER_CREATED, etc. |

---

## 9. User Roles (12)

| Role | Primary Dashboard | Key Capability |
|---|---|---|
| Procurement Manager | Procurement + Vendor | Full procurement KPI access + anomaly alerts |
| Finance User | Financial + Utilization | Payment and CAPEX/OPEX monitoring |
| Compliance Officer | Vendor + Leadership | SOD conflict alerts + audit trail |
| CXO | Leadership | Executive KPIs + AI assistant |
| Leadership | Leadership | Strategic procurement intelligence |
| Partner | Leadership | Client-level procurement view |
| Director | Leadership | Strategic oversight |
| Associate Director | Leadership | Strategic oversight |
| Manager | All dashboards | General analytics access |
| Consultant | All dashboards | General analytics access |
| Delivery Manager | Utilization | CAPEX burn tracking |
| Admin | All + Admin Panel | User management + data upload + recompute |

---

## 10. Deployment Roadmap

### Phase 1 — Baseline (Jan–Jun 2026) ← LIVE
- CSV upload from SAP (9 file types)
- PostgreSQL on Neon serverless
- 45 KPIs across 5 dashboards
- 12 anomaly detectors
- Basic auth (email + password)
- Vercel frontend + cloud VM backend

### Phase 2 — Transition 1 (Jul–Sep 2026)
- Role-gated views (server-side enforcement)
- AI assistant (Ask IntelliSource) — GPT-4o
- Anomaly alerting (email/Teams notifications)
- PDF export of dashboards
- bcrypt passwords + JWT (15-min access + 7-day refresh)
- Mobile-responsive UI
- Docker containerised backend

### Phase 3 — Target Architecture (Oct 2026–Mar 2027)
- SAP BAPI / OData real-time data pull (eliminate manual CSV step)
- Azure Container Apps (backend)
- Azure Database for PostgreSQL Flexible Server
- Azure Active Directory SSO (OAuth 2.0 + MFA via Conditional Access)
- Azure Application Gateway + WAF
- Azure Monitor + Application Insights
- Azure Key Vault (secrets management)
- Azure Blob Storage (backup + CSV staging)

---

## 11. Integration Architecture

| System | Type | Direction | Purpose |
|---|---|---|---|
| SAP ECC / S4HANA | File-based CSV batch | Inbound | Source of all procurement transactional data |
| OpenRouter API | REST HTTPS | Outbound | GPT-4o model for AI assistant |
| Vercel CDN | Static hosting | Outbound | React SPA global edge delivery |
| Azure AD (Target) | OAuth 2.0 / SAML | Inbound | KPMG SSO + MFA |
| GitHub | CI/CD | Outbound | Auto-deploy frontend (Vercel) + backend (ACR) |

---

## 12. Security Posture

### Current (Pilot)
- Email + plaintext password (RISK: R01 — bcrypt required before production)
- Role checked frontend-only (RISK: R02 — JWT middleware required before production)
- Sessions stored in localStorage

### Production Target
- bcrypt (cost factor 12) + JWT (15-min access + 7-day refresh tokens)
- Server-side role enforcement via FastAPI Depends middleware
- Azure AD SSO + MFA via Conditional Access

### Target Architecture
- Azure WAF (OWASP Core Rule Set 3.2)
- Azure Key Vault (all secrets — no .env in prod)
- Azure Log Analytics (5-year audit log retention)
- Private VNet endpoint for PostgreSQL (no public internet exposure)

---

## 13. EA Principles Compliance (KPMG ARB)

| Principle | Status | Note |
|---|---|---|
| Single Capability | ✅ Compliant | P2P analytics only — no scope creep |
| Unified Architecture Governance | ✅ Compliant | ARB submitted |
| API First | ✅ Compliant | All features via REST API |
| Governed Integration | ✅ Compliant | SAP + OpenRouter documented |
| Data is an Asset | ✅ Compliant | 7-year retention policy defined |
| Configure, Do Not Customize | ✅ Compliant | KPI thresholds configurable via Admin |
| Virtual Deployment Preferred | ✅ Compliant | Vercel + Docker + ACA (Target) |
| Think Cloud First | ✅ Compliant | Vercel + Neon → full Azure Target |
| Think Mobility | ⚠️ Partial | Desktop-first now; mobile in Transition 1 |
| Leverage Off-the-Shelf Integration | ❌ Justified | Custom API required for SAP-specific model + 45 custom KPIs |

---

## 14. Key Metrics and Numbers (for communication)

| Metric | Value |
|---|---|
| KPIs computed automatically | 45+ across 5 dashboards |
| Anomaly categories detected | 12 |
| SAP data file types ingested | 9 |
| Database tables | 14 |
| User roles supported | 12 |
| P2P lifecycle stages covered | PR → PO → GRN → Invoice → Payment |
| AI tool definitions | 6 (live PostgreSQL queries) |
| Target cycle time reduction | 40–60% (vs manual Excel baseline) |
| Maverick spend detection | Real-time (vs audit-only in current state) |
| Data freshness | Near-real-time (on each upload) |
| Deployment | Vercel CDN (global) + PostgreSQL (managed cloud) |
| Target hosting | Full Azure (Container Apps + PostgreSQL + AD + WAF) |

---

## 15. Competitive Differentiators

1. **SAP-native data model** — not a generic dashboard; built around actual SAP table structures (EKKO/EKPO/MSEG/BKPF/LFA1)
2. **45 pre-computed KPIs** — all validated against live frontend; no placeholder metrics
3. **12-anomaly real-time classifier** — covers the most common procurement fraud and control failure patterns
4. **Embedded AI assistant** — not a chatbot; an agentic tool-calling engine with live SQL access to production data
5. **5-role-specific dashboards** — not one dashboard for all; each persona sees exactly what they need
6. **Full P2P lifecycle** — PR through Payment, including change log tracking and audit trail
7. **KPMG-grade audit trail** — all user actions logged; compliant with 7-year procurement data retention
8. **Azure-ready architecture** — roadmapped to full enterprise Azure deployment with SSO, WAF, Key Vault

---

## 16. File Inventory (ARB Folder)

| File | Purpose |
|---|---|
| ARB_Solution_Review_Specification.docx | Blank KPMG ARB template |
| IntelliSource_Filled.docx | Filled ARB submission — Draft 1.0, 30 Jun 2026 |
| P2P_KPIs.xlsx | 45 KPIs with exact SQL queries and formulas |
| IntelliSource_BPD.png | Executive P2P flow diagram |
| IntelliSource_BPD_Teams.png | Swim-lane team BPD (9 actor lanes) |
| IntelliSource_BPD_Teams.md | Mermaid source for swim-lane BPD |
| IntelliSource_ARB_Diagrams.md | All 11 ARB architecture diagrams (Mermaid source) |
| D01–D11 .mmd + .png | 11 individual architecture diagrams — source + rendered PNG |
| IntelliSource_Application_Context.md | This file — complete application context reference |
