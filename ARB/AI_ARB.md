# ARB Solution Review — AI-Based Solution
## KPMG IntelliSource Platform (with Ask IntelliSource AI Assistant)

> Record of all content filled into `ARB Solution Review - AI Based solution.docx.docx`.
> Base = the filled IntelliSource ARB; **AI-specific additions are marked 🟦 AI**.
> AI model hosting documented as **Azure OpenAI GPT-4o (KPMG tenant, target)**; the
> pilot uses OpenRouter GPT-4o (external) — flagged for retirement before production.

---

## Version Management

| Version | Date | Change Description | Author |
|---|---|---|---|
| Draft 1.0 | 30 Jun 2026 | Initial ARB submission for IntelliSource | Aryan Sharma |
| 🟦 Draft 1.1 | 04 Aug 2026 | AI solution inclusion — Ask IntelliSource (Azure OpenAI GPT-4o) governance, integration, and impact assessment added | Satyam Barnwal |

---

## 1. Background and Business Vision

| Field | Detail |
|---|---|
| **Solution Name & Brief** | KPMG IntelliSource Platform — an internal Procure-to-Pay (P2P) intelligence and analytics platform. Ingests SAP procurement data (PR, PO, GRN, Invoices, Payments, Vendor Master, Change Logs) via structured CSV uploads, computes pre-defined KPIs across five dashboards (Procurement, Financial, Vendor, Leadership, Utilization), and detects procurement anomalies in real time. 🟦 Also includes **Ask IntelliSource** — an AI assistant that answers natural-language procurement questions grounded on the live database via read-only tool-calling (Azure OpenAI GPT-4o, KPMG tenant; pilot on OpenRouter GPT-4o). |
| **Business Problem / Opportunity** | Procurement teams rely on manual SAP report extracts. Gaps: no unified real-time P2P visibility (PR→PO→GRN→Invoice→Payment); reactive anomaly detection (maverick buys, duplicate invoices, split POs, price deviations, GRN mismatches); vendor/delivery/spend tracked in disconnected spreadsheets; no consolidated CAPEX/OPEX & approval-cycle view for leadership. |
| **Business Motivation & Justification** | Reduces reporting effort from days to seconds via pre-computed auto-refreshing KPIs; enables proactive anomaly resolution before month-close; single source of truth across 3 company codes (1001/1002/1003); real-time CAPEX/OPEX, budget vs actuals, vendor risk for leadership; 🟦 reduces dependency on SAP report specialists via an AI assistant that answers natural-language questions against the live database. |
| **End User** | KPMG Internal Employees (Procurement, Finance, Compliance, Leadership, Admin) |
| **Business Analyst** | Manu Mohanan |
| **Business Owner** | Manu Mohanan |
| **Solution Architect** | Satyam Barnwal |
| **Team Lead / Delivery Manager / BRM** | Meena Mittal |

**Project Summary** — Project: KPMG IntelliSource Platform · Phase: Initiation, Phase 1 · Delivery: Agile · PM/Product Owner: Meena Mittal

---

## 2. Strategic Focus Areas

Improve Operational Efficiencies ✓ · Enable future vision ✓ · Enable new business ✓ · Legal/Regulatory compliance ✗ · Technological sustainability ✓ · Cost savings ✓ · Enable new/alternative revenue ✗ · Enable new/future business channels ✓

---

## 3. Functional Requirements (selected)

| ID | Name | M/G/O |
|---|---|---|
| FR01 | SAP Data Upload (9 CSV types, schema validation) | M |
| FR02 | Procurement Dashboard (8 KPIs + charts) | M |
| FR03 | P2P Lifecycle Tracker (funnel, conversion, cycle days, RAG) | M |
| FR04 | Financial Dashboard (CAPEX/OPEX, budget vs actuals, spend trend) | M |
| FR05 | Vendor Performance Dashboard (delivery, compliance, spend, MSME) | M |
| FR06 | Leadership Dashboard (executive KPIs, profit centre, YoY) | M |
| FR07 | Utilization Analytics | G |
| FR08 | Profit Centre Analytics | G |
| 🟦 **FR09** | **AI Assistant (Ask IntelliSource)** — Natural-language query interface powered by GPT-4o. **Target hosting: Azure OpenAI in KPMG tenant over Private Link; pilot uses OpenRouter GPT-4o (external — to be retired before production).** Agentic tool-calling loop with **6 READ-ONLY tools**: `query_database`, `get_kpis`, `find_document`, `get_anomalies`, `get_vendor_info`, `get_p2p_stage_summary`. Always calls a tool before answering data questions; never fabricates numbers; **no write access** to SAP or PostgreSQL. | M |
| FR10 | Anomaly Detection (MAVERICK_BUY, DUPLICATE_INVOICE, SPLIT_PO, PRICE_DEVIATION, THREE_WAY_MISMATCH, GRN_WITHOUT_PO, PAYMENT_BEFORE_GRN, LATE_DELIVERY, VENDOR_BLOCK, RETRO_PO, DELETED_AFTER_GRN) | M |
| FR11 | PO Deletion Monitor | M |
| FR12 | User Management (12 roles, admin CRUD) | M |
| FR13 | Audit Log | M |
| FR14 | Admin Settings (KPI thresholds, company codes) | M |
| FR15 | Dashboard PDF Export | G |
| FR16 | Company Code Filter (1001/1002/1003/ALL) | M |
| FR17 | Vendor Repository | G |
| FR18 | Actions Tracker | G |

### 🟦 AI Testing Scenarios (Ask IntelliSource)

- **Worst-case scenarios tested:** adversarial / prompt-injection strings embedded in uploaded procurement data; malformed or ambiguous NL questions; requests that attempt to modify data (must be refused — read-only); over-large result sets (mitigated by LIMIT injection + result compression); LLM timeout and rate-limit (429) conditions; concurrent chat sessions.
- **Simulation / stress-testing:** **Yes** (planned before production go-live). Methodology — (a) curated question bank with known ground-truth answers for accuracy regression; (b) red-team prompt set for injection / jailbreak; (c) concurrent-session load test against `/api/chat`. Tools — pytest regression harness, scripted load generator, manual red-team review.

---

## 4. Non-Functional Requirements (platform)

**Compatibility** — Co-exists with SAP ECC/S4HANA (additive; does not modify SAP data). Interoperability via FastAPI REST (HTTP/HTTPS, JSON); 🟦 Azure OpenAI over HTTPS/JSON; future SAP BAPI/OData.
**Maintainability** — Pluggable KPI engine; routers as modules; file-based routing. Monitoring via `/api/health`, audit log; APM + slow-query logging in production. 3-tier support.
**Portability** — Any Linux/Windows host (Python 3.11+, PostgreSQL 15+); frontend to any CDN. Docker planned Transition-1.
**Reliability** — Nightly full DB backup + 4-hourly log backup (prod). Retention: transactional 7 yrs, audit 5 yrs. Maintenance Sun 00:00–04:00 IST. MTTR < 4 h (prod). RPO 4 h / RTO 8 h (Gold, prod); pilot Bronze. Owner: Meena Mittal.
**Security** — Full audit log; email+password auth (**plaintext in pilot — bcrypt required before prod**); RBAC 12 roles (**backend JWT/server-side session required before prod**); MSMED Act compliance; no external-party PII.
**Usability** — Web (Chrome/Edge/Firefox), desktop-first; English/INR; WCAG in Transition-1.
**Performance** — 20–50 concurrent users; 8 pre-warmed PG connections/worker; 5–20 GB/yr; Up & Out scaling; 1 Mbps/user, 10 Mbps bulk upload.

---

## 🟦 5. Non-Functional Requirements (AI-Based only) — Ask IntelliSource

### Human agency and oversight
| Attribute | Detail |
|---|---|
| **Level of autonomy** | No autonomous action. Advisory and **read-only** — answers questions, never writes to SAP/PostgreSQL, never initiates a transaction. Human in the loop for all decisions; the assistant informs, humans act. |
| **Need for human reviewers** | Yes. Outputs are informational, grounded on the same live data the user can see in dashboards, and traceable to the tool/query used (`tools_used` returned). No AI output auto-executes a business action. |
| **Dangers of removing oversight** | Fully automated decision-making is NOT enabled and is out of scope. If removed, incorrect figures (mis-generated SQL or hallucination) could mislead decisions. Mitigations: mandatory tool-grounding, read-only SQL guard, source-traceable numbers, temperature 0.1. |

### Reliability / Technical Robustness
| Attribute | Detail |
|---|---|
| **Predictable failures & mitigations** | Robustness testing planned before production. Failure modes → mitigations: invalid SQL → read-only guard + LIMIT + surfaced error; hallucinated numbers → "never invent numbers, always call a tool" rule; LLM timeout/rate-limit → retry with back-off + fallback message; prompt injection via data → parameterised structured tools + read-only DB role. Adversarial + stress testing via question bank, red-team prompts, concurrent-session load. |

### Transparency and Explainability
| Attribute | Detail |
|---|---|
| **Comprehensibility** | Not a black box in operation — exposes tools/queries used; figures cross-checkable against dashboards. GPT-4o itself is opaque; justified because it is only a language/reasoning layer over deterministic, auditable read-only SQL tool outputs (the authoritative data, not the model). |
| **Complexity** | Moderate — agentic loop (max 8 iterations, ≤3 tool calls/answer). Justified: multi-table P2P questions require reasoning across PR→PO→GRN→Invoice→Payment. |

### Diversity, non-discrimination and fairness
| Attribute | Detail |
|---|---|
| **Demographics** | No impact — data is internal procurement transactions; no personal/protected attributes analysed; no profiling of persons. Residual vendor-treatment bias mitigated: answers reflect only factual recorded data. |
| **Societal well-being** | Indirect positive — improves compliance, MSME payment monitoring, spend transparency. No adverse impact. |

### Involvement of Individuals
| Attribute | Detail |
|---|---|
| **Affected individuals** | KPMG internal procurement/finance/leadership users (in stakeholder analysis). Feedback via in-app + service desk. Users retain full control — AI only informs. |

### Environmental Wellbeing
| Attribute | Detail |
|---|---|
| **Energy efficiency (training)** | Pre-trained hosted model (Azure OpenAI GPT-4o); no training/fine-tuning from scratch; zero training compute; inference only. |
| **Resource utilization** | Managed/serverless inference; no idle GPU owned; Container Apps scale to zero; calls only on user query. |
| **Sustainable data management** | No vector DB/embeddings index (tool-calling on live relational data, not RAG) → minimal storage; capped in-session history (≤20 messages). |
| **Eco-friendly infrastructure** | Microsoft Azure (serverless Container Apps + managed Azure OpenAI); Azure committed to 100% renewable energy / carbon-negative. |

---

## 🟦 6. Data Governance (AI)

| Item | Detail |
|---|---|
| **Primary data sources** | Proprietary internal only — live PostgreSQL procurement DB (`po_dump`, `pr_dump`, `grn_dump`, `po_invoice_dump`, `invoice_dump`, `payment_dump`, `vendor_master`, `kpi_results`, `pr_po_grn_invoice`, `process_mining_events`). No public data, no third-party knowledge base. The model receives only the specific rows returned by governed read-only tools plus the schema description — never the whole database. |
| **Data versioning / update frequency** | Data refreshed on each CSV upload; KPIs recomputed. Assistant always queries live data at question time — no stale cached AI knowledge, no external knowledge source to version. |
| **Self-correction / discarding incorrect data** | System prompt forces tool-grounding and forbids inventing numbers; tool errors are returned, not masked. Regex write-guard blocks INSERT/UPDATE/DELETE/DDL; LIMIT + result compression prevent oversized/inconsistent context. Harmful/biased output filtering via Azure OpenAI content filters (target). |
| **Metrics for go-live** | Answer accuracy vs ground-truth question bank ≥ threshold; tool-grounding rate = 100% for data questions; zero write operations; P95 latency target; uptime target. |
| **Success metrics** | Latency, accuracy, throughput, uptime. |
| **Responsibilities for model performance** | Dev team + KPMG Responsible-AI reviewer (accuracy/regression); IT Ops (availability/latency). |
| **Model confidence** | GPT-4o emits no calibrated probabilities; confidence handled by design — deterministic tool outputs are authoritative. Uncertain questions → ask for clarification or state cannot answer; temperature 0.1 reduces variance. |

---

## 🟦 7. Operation & Monitoring (AI)

| Item | Detail |
|---|---|
| Components monitored | AI request/response logs, tool-call logs, LLM latency & error rate, token usage/cost, DB query performance, chat-endpoint uptime, Azure OpenAI service health. |
| Training programs for users | In-app guidance/tooltips: advisory, verify against dashboards; onboarding covers limitations (read-only, data-grounded). |
| Decision-making power of AI | None autonomous — advisory only. |
| Process to overrule AI | Inherent — AI never executes; user disregards/verifies. No action-override needed. |
| Monitoring input/output quality | Prompts/answers logged; periodic sampling vs source data; errors captured. |
| Detecting drift | Model externally hosted/managed (Azure OpenAI) — drift managed by provider + version pinning. Data drift N/A (no fine-tuning). Question-bank regression on model-version change. |
| Versioned code repository | Yes — all AI code (chat_engine, chat_tools, prompts, tool schemas) in GitHub; model deployment version pinned. |
| Maintenance/update schedule | Deployment reviewed on Azure OpenAI version updates; code via standard release cycle; prompts change-controlled. |
| Responsibilities for updates | Dev team (code/prompts); IT Ops (Azure OpenAI deployment); Responsible-AI reviewer (sign-off). |
| Software tests | Question-bank regression + read-only guard tests + integration tests before deploy. |
| Stability period before deployment | Defined soak/monitoring period in QA before Production. |
| Reporting AI output concerns | In-app feedback + service desk → dev + Responsible-AI reviewer; incident process for material errors. |

---

## 🟦 8. AI — System Impact Assessment (AISIA 01)

| Aspect | Assessment |
|---|---|
| **System** | Ask IntelliSource — natural-language P2P analytics assistant |
| **Purpose** | Answer procurement questions grounded on live internal data |
| **Autonomy** | Advisory, read-only; human-in-the-loop for every decision |
| **Data** | Internal KPMG procurement transactions only; no personal/special-category data; no data used to train the model |
| **Model & hosting** | Azure OpenAI GPT-4o in KPMG tenant over Private Link (**target**); pilot uses OpenRouter GPT-4o (external, US-hosted) — **must be retired before production** due to data-egress risk |
| **Key risks** | Hallucination, incorrect SQL generation, prompt injection, external data egress (pilot) |
| **Mitigations** | Mandatory tool-grounding, read-only DB role, LIMIT/result caps, low temperature (0.1), Azure OpenAI content filters, in-tenant hosting for production |
| **Impact classification** | Low-to-Medium — advisory internal tool, no automated decisions, no PII |
| **Residual risk** | Acceptable for pilot; Azure OpenAI migration + robustness testing required before production |

---

## 9. Compliance & Standards

CSR01 KPMG Data Classification (Confidential) · CSR02 MSMED Act (India) · CSR03 KPMG Password Policy · CSR04 Audit Trail (≥5 yrs)

---

## 10. Solution Architecture (attributes)

| Attribute | Detail |
|---|---|
| Application Classification | Supporting Technology Solution (internal analytics/intelligence) |
| Deployment/Hosting | Hybrid — SPA on CDN; FastAPI on VM/container; PostgreSQL managed; 🟦 Azure OpenAI (managed) for AI |
| Current Status | Live (pilot) |
| Future Approach | Keep & enhance — Azure AD SSO, SAP BAPI, 🟦 Azure OpenAI migration |
| Criticality | Medium (Gold/Silver); Continuity Bronze (RTO/RPO 1–3 days pilot) |
| DR | Not required in pilot; Warm post go-live |

---

## 11. Information Architecture

**Dashboards:** Procurement · P2P Lifecycle Tracker · Financial · Vendor Performance · Leadership · Utilization · Profit Centre.
**Core data entities:** pr_dump, po_dump, po_delivery_dump, grn_dump, po_invoice_dump, invoice_dump, payment_dump, vendor_master, change_log, kpi_results, process_mining_events, pr_po_grn_invoice, users, audit_log, Budget_Master.
🟦 **AI data handling:** Ask IntelliSource reads the above via read-only tools; conversation history is transient (≤20 messages, not persisted); no separate AI datastore, no embeddings index.
**Retention:** transactional 7 yrs · audit 5 yrs · KPI results rolling 36 months (recomputable) · users employment+2 yrs · change log 7 yrs.

---

## 12. Application Architecture

**Components:** React SPA (frontend) · FastAPI backend (8 routers incl. `chat`) · KPI Engine · ETL Pipeline · Anomaly/Process-Mining Engine · PostgreSQL · Auth & Session · 🟦 **AI Assistant Engine** (agentic loop `chat_engine.py` + read-only tools `chat_tools.py`, calling Azure OpenAI GPT-4o).
**Data storage:** PostgreSQL 15+ (primary); local filesystem (seed CSV only).

---

## 13. Integration Architecture

| Source | Target | Details | Type |
|---|---|---|---|
| 🟦 IntelliSource Platform (FastAPI) | Azure OpenAI — GPT-4o (KPMG tenant) | NL question + tool schemas over HTTPS/JSON via Private Link; model returns tool calls / final answer. Only query-scoped result rows + schema shared — no bulk data. Pilot: OpenRouter GPT-4o (external) — to be replaced. | New |
| 🟦 Azure Active Directory | IntelliSource Platform | SSO / OAuth 2.0 identity & role tokens (Target Architecture) | New |
| SAP ERP | IntelliSource | File-based CSV export → `POST /api/upload` | New |

---

## 14. Technology Architecture

**Environments:** Dev (local, 8AM–8PM) · QA/Staging (24×7, cloud VM + managed PG) · Production (24×7×365).
**Ops:** Azure Monitor + App Insights; Log Analytics; 🟦 Azure OpenAI service health + token/cost monitoring.

---

## 15. Security Architecture

**Authentication (current):** email+password → `POST /api/auth/login` (plaintext in pilot; bcrypt before prod). **Target:** Azure AD SSO + MFA (OAuth 2.0).
**Authorization:** RBAC 12 roles; frontend route-level today; server-side/JWT before prod.
🟦 **AI security:** read-only DB role for the assistant; write-guard regex; Private Link to Azure OpenAI; no procurement data used for model training; content filters (target).

---

## 16. Bill of Materials & Licensing

React/TS/Vite · Tailwind · Recharts · FastAPI · Python 3.11 · psycopg3 · PostgreSQL 15 · Uvicorn — all Open Source.
🟦 **Azure OpenAI (GPT-4o)** — Microsoft Azure; managed cloud service; **consumption-based (per 1K tokens) under Azure EA**; pilot used OpenRouter (pay-per-use, external) — to be retired.

---

## 17. Risks (incl. 🟦 AI)

- SAP CSV schema changes break ETL.
- Thread-local PG pooling may leak connections under high concurrency.
- 🟦 **AI — Hallucination / incorrect SQL:** mitigated by mandatory tool-grounding, read-only guard, "never invent numbers" rule, temperature 0.1; robustness testing before production.
- 🟦 **AI — Data egress:** pilot sends query results to external OpenRouter/OpenAI (US). Procurement data is KPMG Confidential — migrate to Azure OpenAI (KPMG tenant, Private Link) before production.
- 🟦 **AI — Prompt injection:** malicious strings in uploaded data; mitigated by parameterised structured tools + read-only DB role (no tool can write).

---

## 18. Team Dependencies

- KPMG IT Infrastructure — production PostgreSQL + backend VM.
- KPMG IT Security — auth review, penetration testing, secrets (Key Vault).
- 🟦 **KPMG Responsible AI / AI Governance** — review of Ask IntelliSource per KPMG AI policy; AISIA sign-off + Azure OpenAI data-handling review before production.

---

## 19. Diagrams updated with the AI component

Kept the existing diagrams; added the **Ask IntelliSource / Azure OpenAI GPT-4o** component to five:

| Diagram | AI addition |
|---|---|
| D01 Business Process (To-Be) | "Ask IntelliSource" platform node + users' NL query flow to Azure OpenAI GPT-4o |
| D05 App Arch (Conceptual/Logical) | "AI Assistant (Ask IntelliSource)" service → read-only SQL tools + Azure OpenAI GPT-4o via Private Link |
| D06 Technology Stack | New "AI Layer" column: Azure OpenAI GPT-4o, agentic tool-calling, live-DB grounding, Private Link |
| D07 Integration (Solution Context) | New "AI-Based" integration pattern → Azure OpenAI GPT-4o service |
| D08 Azure Deployment | New "Azure AI Zone" (Azure OpenAI GPT-4o, Private Endpoint) called by Container App |

Unchanged: D02 (As-Is), D03 (Conceptual Data Model), D04 (CRUD), D09 (Authentication), D10 (Authorization), D11 (EA Principles).

---

*Deliverable file:* `ARB/ARB Solution Review - AI Based solution.docx.docx`
*Rebuild:* `python ARB/build_ai_arb.py` (requires the 5 AI diagrams under `ARB/Diagrams/`).
