# IntelliSource — ARB Architecture Diagrams
**KPMG ARB Solution Review Specification**  
Solution: KPMG IntelliSource (P2P Intelligence Platform)  
Version: Draft 1.0 | Date: 30 Jun 2026 | Author: Aryan Sharma

> All diagrams correspond to sections in `ARB_Solution_Review_Specification.docx`  
> and use context from `IntelliSource_Filled.docx`.

---

## Section 7.1 — Business Process (To-Be)

> Swimlane BPMN process diagram showing the P2P lifecycle **after** IntelliSource deployment.  
> SAP data flows through the upload module into PostgreSQL; KPI Engine and Anomaly Engine auto-compute metrics; each role accesses role-specific dashboards in real time.

```mermaid
flowchart TD
    classDef sapStyle   fill:#FADBD8,stroke:#C0392B,color:#1A0808,stroke-width:2px
    classDef adminStyle fill:#FDEBD0,stroke:#7D4E05,color:#3D1F03,stroke-width:2px
    classDef procStyle  fill:#D6EAF8,stroke:#1A5276,color:#0A2035,stroke-width:2px
    classDef finStyle   fill:#D5F5E3,stroke:#1E6823,color:#0A2D0F,stroke-width:2px
    classDef compStyle  fill:#FADBD8,stroke:#922B21,color:#1A0808,stroke-width:2px
    classDef leadStyle  fill:#EBD5F7,stroke:#512E5F,color:#200A2A,stroke-width:2px
    classDef sysStyle   fill:#E8F0FE,stroke:#1565C0,color:#0A1E4A,stroke-width:2px
    classDef decStyle   fill:#FEF9E7,stroke:#D4AC0D,color:#3D2B00,stroke-width:2px

    subgraph SAP["SAP ECC / S4HANA — Data Source"]
        S1["Export 9 SAP table dumps as CSV\nPR · PO · GRN · Invoice · Payment\nVendor Master · Change Log · PO Delivery · PO Invoice"]
    end

    subgraph ADMIN["IntelliSource Admin / Data Specialist"]
        A1["Upload CSVs via\nIntelliSource Upload Portal"]
        A2{"Schema &\nValidation Check"}
        A3["ETL loads data into\nPostgreSQL — 10 tables"]
        A4["KPI Engine computes\n45+ KPIs → kpi_results"]
        A5["Anomaly Engine classifies\n12 PO risk variants"]
        A1 --> A2
        A2 -->|Valid| A3
        A2 -->|Invalid rows| A6["Rejection Report\nshown to admin"]
        A3 --> A4
        A3 --> A5
    end

    subgraph PROC["Procurement Manager"]
        P1["Review Procurement Dashboard\nPO Value MTD · Active POs · Open PR Aging\nPO Approval Cycle · Amendment Rate"]
        P2["Act on Anomaly Alerts\nMaverick Buys · Split POs · Deletions"]
        P3["Monitor Vendor Performance\nDelivery Days · Compliance Rate"]
    end

    subgraph FIN["Finance User / AP Team"]
        F1["Review Financial Dashboard\nTotal Payments YTD · 3-Way Match Rate\nInvoice Processing Days · On-Time Payment Rate"]
        F2["Monitor CAPEX vs OPEX Split\nUtilization Dashboard — 10 KPIs"]
    end

    subgraph COMP["Compliance Officer"]
        C1["Review SOD Conflict Alerts\n4 SOD control scenarios"]
        C2["Duplicate Invoice Detection\nAnomaly & Risk Report"]
        C3["Escalate to Leadership\nif threshold exceeded"]
    end

    subgraph LEAD["Leadership / CXO"]
        L1["Review Leadership Dashboard\nTotal Spend YTD · Maverick Rate\nVendor Concentration · Risk Score"]
        L2["Query AI Assistant\nAsk IntelliSource — natural language\nqueries against live PostgreSQL"]
        L3["Strategic P2P Decision"]
    end

    S1 -->|"Batch CSV download\n(manual or scheduled)"| A1
    A4 -->|"KPI Cards + Charts"| P1
    A5 -->|"Anomaly Alert Center"| P2
    A4 -->|"Vendor KPIs"| P3
    A4 -->|"Financial KPIs"| F1
    A4 -->|"CAPEX/OPEX KPIs"| F2
    A5 -->|"SOD flag alerts"| C1
    A5 -->|"Duplicate flags"| C2
    C1 --> C3
    C2 --> C3
    A4 -->|"Executive KPIs"| L1
    L1 -->|"Ad-hoc deep-dive"| L2
    L1 --> L3
    C3 -->|"Escalation report"| L3

    class S1 sapStyle
    class A1,A3,A4,A5,A6 adminStyle
    class A2 decStyle
    class P1,P2,P3 procStyle
    class F1,F2 finStyle
    class C1,C2,C3 compStyle
    class L1,L2,L3 leadStyle
```

---

## Section 7.2 — Business Process (As-Is)

> Current state P2P process **before** IntelliSource.  
> All analytics are manual — SAP report extracts, Excel pivots, email distribution — with significant delays and blind spots.

```mermaid
flowchart TD
    classDef sapStyle  fill:#FADBD8,stroke:#C0392B,color:#1A0808,stroke-width:2px
    classDef procStyle fill:#D6EAF8,stroke:#1A5276,color:#0A2035,stroke-width:2px
    classDef finStyle  fill:#D5F5E3,stroke:#1E6823,color:#0A2D0F,stroke-width:2px
    classDef leadStyle fill:#EBD5F7,stroke:#512E5F,color:#200A2A,stroke-width:2px
    classDef gapStyle  fill:#F8F9FA,stroke:#E74C3C,color:#C0392B,stroke-width:2px,stroke-dasharray:6 3

    subgraph SAP["SAP ECC / S4HANA — Live Transaction System"]
        S1["SAP MM / FI Modules\nPR · PO · GRN · Invoice · Payment"]
        S2["Run Standard SAP Reports\nME2M · MB52 · FBL1N · ME80FN etc."]
        S1 --> S2
    end

    subgraph PROC["Procurement Team"]
        P1["Download Excel / PDF from SAP\nManual report extract — T+1 to T+5 delay"]
        P2["Consolidate data across\nmultiple disconnected reports"]
        P3["Build Excel pivot tables\nManual KPI calculation"]
        P4["Email consolidated report\nto Finance & Leadership\nweekly / monthly cycle"]
        P5["Issues identified only at\nmonth-end review or during audit"]
        P1 --> P2 --> P3 --> P4
    end

    subgraph FIN["Finance / AP Team"]
        F1["Pull FI module reports\nfor invoice and payment status"]
        F2["Track CAPEX/OPEX in\nseparate shared spreadsheet\nManual classification"]
        F3["Reconcile 3-way match\nmanually line by line"]
        F1 --> F2 --> F3
    end

    subgraph VEND["Vendor Management"]
        V1["Vendor performance tracked\nin disconnected spreadsheets\nNo central view"]
        V2["MSME compliance not\nsystematically monitored"]
    end

    subgraph LEAD["Leadership / CXO"]
        L1["Receive consolidated report\nvia email — T+5 to T+10 delay\nStale data at time of review"]
        L2["No drill-down capability\nRequest further analysis from team\nadds another T+2 to T+5 delay"]
        L3["Decisions made on\nincomplete / stale data"]
        L1 --> L2 --> L3
    end

    subgraph GAPS["Process Gaps — Current State Pain Points"]
        G1["No real-time P2P visibility\nAll data is retrospective"]
        G2["Anomaly detection is reactive\nMaverick buys · Split POs found in audit only"]
        G3["No centralised vendor health view\nSpend concentration unknown in real time"]
        G4["CAPEX vs OPEX split\nrequires manual classification effort"]
        G5["No natural language query\nSQL expertise required for ad-hoc analysis"]
        G6["No SOD conflict monitoring\nAudit trail not easily searchable"]
    end

    S2 -->|"Manual extract"| P1
    S2 -->|"FI reports"| F1
    P4 --> L1
    P5 -.->|"Pain point"| G2
    P2 -.->|"Pain point"| G1
    F2 -.->|"Pain point"| G4
    V1 -.->|"Pain point"| G3
    L2 -.->|"Pain point"| G5
    P2 -.->|"Pain point"| G6

    class S1,S2 sapStyle
    class P1,P2,P3,P4,P5 procStyle
    class F1,F2,F3 finStyle
    class V1,V2 procStyle
    class L1,L2,L3 leadStyle
    class G1,G2,G3,G4,G5,G6 gapStyle
```

---

## Section 11.3 — Information Architecture – Conceptual Data Model

> Entity-relationship diagram for the 14 PostgreSQL tables in IntelliSource.  
> Core procurement tables linked via purchasing_document (PO key) and vendor code.  
> pr_po_grn_invoice is the denormalised P2P fact table used for lifecycle analytics.

```mermaid
erDiagram
    PR_DUMP {
        text purchase_requisition PK
        text item_of_requisition PK
        text material_group
        text material_description
        real order_quantity
        text delivery_date
        text requisitioner
        text release_status
        text deletion_indicator
        text company_code
        text created_on
    }

    PO_DUMP {
        text purchasing_document PK
        text item PK
        text vendor FK
        real net_order_value
        text document_date
        text company_code
        text plant
        text material_group
        text deletion_indicator
        text capex_opex_flag
        text purchase_requisition FK
        text release_indicator
        text created_by
        text delivery_completed
        text contract_number
    }

    GRN_DUMP {
        text material_document PK
        text material_doc_item PK
        text purchasing_document FK
        text item FK
        text movement_type
        text debit_credit_ind
        text posting_date
        text entry_date
        real quantity
        real amount_local_ccy
        text created_by
        text company_code
    }

    PO_DELIVERY_DUMP {
        text purchasing_document PK
        text item PK
        text schedule_line PK
        text expected_delivery_date
        real scheduled_quantity
        text creation_date
        text company_code
    }

    PO_INVOICE_DUMP {
        text invoice_doc PK
        text invoice_year PK
        text invoice_doc_item PK
        text purchasing_document FK
        text item FK
        text debit_credit_ind
        text posting_date
        text entry_date
        real quantity
        real amount_local_ccy
        text created_by
    }

    INVOICE_DUMP {
        text invoice_doc PK
        text invoice_year PK
        text vendor FK
        text document_type
        text posting_date
        text due_date
        real amount_local_ccy
        text clearing_doc
        text reverse_invoice
        text vendor_invoice_ref
        text company_code
        text created_by
    }

    PAYMENT_DUMP {
        text payment_doc PK
        text payment_year PK
        text vendor FK
        text posting_date
        text clearing_date
        text cleared_invoice FK
        text payment_method
        real amount_local_ccy
        text debit_credit_ind
        text company_code
        text created_by
        text house_bank
    }

    VENDOR_MASTER {
        text vendor PK
        text company_code PK
        text vendor_name
        text country
        text city
        text account_group
        text central_purchasing_block
        text central_posting_block
        text deletion_flag_central
        text payment_block
        text posting_block_cc
        text msme_flag
        text vendor_type
    }

    CHANGE_LOG {
        text change_number PK
        text table_name PK
        text field_name PK
        text object_class
        text object_id
        text username
        text change_date
        text change_indicator
        text old_value
        text new_value
        text tcode
    }

    PR_PO_GRN_INVOICE {
        text purchase_requisition PK
        text purchasing_document FK
        text vendor FK
        int pr_to_po_days
        int po_to_grn_days
        int grn_to_invoice_days
        int total_cycle_days
        int is_maverick
        real pr_value
        real po_net_price
        real po_quantity
        text capex_opex_flag
    }

    KPI_RESULTS {
        text dashboard PK
        text kpi_code PK
        text company_code PK
        text kpi_name
        real value_numeric
        text value_text
        text unit
        text trend
        timestamp computed_at
    }

    PROCESS_MINING_EVENTS {
        text purchasing_document PK
        text anomaly_flags
        int anomaly_count
        text variant_class
        text company_code
    }

    USERS {
        uuid user_id PK
        text email
        text full_name
        text role
        text password
        boolean is_active
        timestamp created_at
        text created_by
    }

    AUDIT_LOG {
        uuid id PK
        uuid user_id FK
        text action
        text entity_type
        text details
        timestamp created_at
    }

    PR_DUMP       ||--o{ PO_DUMP              : "PR referenced in PO"
    PO_DUMP       ||--o{ GRN_DUMP             : "GRN posted against PO"
    PO_DUMP       ||--o{ PO_DELIVERY_DUMP     : "Delivery schedule for PO"
    PO_DUMP       ||--o{ PO_INVOICE_DUMP      : "Invoice matched to PO"
    INVOICE_DUMP  ||--o{ PAYMENT_DUMP         : "Payment clears invoice"
    VENDOR_MASTER ||--o{ PO_DUMP              : "Vendor on PO"
    VENDOR_MASTER ||--o{ INVOICE_DUMP         : "Vendor submits invoice"
    VENDOR_MASTER ||--o{ PAYMENT_DUMP         : "Vendor receives payment"
    PO_DUMP       ||--o{ CHANGE_LOG           : "PO amendments logged"
    PR_DUMP       ||--o| PR_PO_GRN_INVOICE    : "PR in P2P fact"
    PO_DUMP       ||--o| PR_PO_GRN_INVOICE    : "PO in P2P fact"
    PO_DUMP       ||--o| PROCESS_MINING_EVENTS: "PO anomaly classification"
    USERS         ||--o{ AUDIT_LOG            : "User actions logged"
```

---

## Section 11.4 — Information Architecture – Data / CRUD Model

> Shows which system component performs Create / Read / Update / Delete on each data entity.  
> ETL pipeline owns all source table writes. KPI engine reads source tables and upserts kpi_results.  
> Frontend is read-only via API.

```mermaid
flowchart LR
    classDef etlStyle    fill:#FDEBD0,stroke:#7D4E05,color:#3D1F03,stroke-width:2px
    classDef apiStyle    fill:#E8F0FE,stroke:#1565C0,color:#0A1E4A,stroke-width:2px
    classDef kpiStyle    fill:#D5F5E3,stroke:#1E6823,color:#0A2D0F,stroke-width:2px
    classDef authStyle   fill:#EBD5F7,stroke:#512E5F,color:#200A2A,stroke-width:2px
    classDef dbStyle     fill:#F5EEF8,stroke:#512E5F,color:#2C0A3A,stroke-width:2px

    subgraph WRITERS["Write Layer"]
        ETL["ETL Pipeline\netl.py · fact_builder.py\n/api/upload"]
        KE["KPI Engine\nkpi_engine.py\n/api/kpi/recompute"]
        AE["Anomaly Engine\nprocess_mining.py"]
        AUTH["Auth Router\n/api/auth"]
    end

    subgraph READERS["Read Layer"]
        KPI_R["KPI Router\n/api/kpi"]
        P2P_R["P2P Router\n/api/p2p"]
        CHAT_R["AI Chat Engine\n/api/chat"]
        AUDIT_R["Audit Reader\n/api/admin"]
    end

    subgraph TABLES["PostgreSQL Tables — CRUD Legend: C=Create  R=Read  U=Update  D=Delete"]
        T1[("po_dump\nC · R · D")]
        T2[("pr_dump\nC · R · D")]
        T3[("grn_dump\nC · R · D")]
        T4[("po_delivery_dump\nC · R · D")]
        T5[("po_invoice_dump\nC · R · D")]
        T6[("invoice_dump\nC · R · D")]
        T7[("payment_dump\nC · R · D")]
        T8[("vendor_master\nC · R · D")]
        T9[("change_log\nC · R · D")]
        T10[("pr_po_grn_invoice\nC · R · U")]
        T11[("kpi_results\nC · R · U")]
        T12[("process_mining_events\nC · R · U")]
        T13[("users\nC · R · U · D")]
        T14[("audit_log\nC · R")]
    end

    ETL  -->|"TRUNCATE + INSERT\n(per upload cycle)"| T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 & T9
    ETL  -->|"BUILD fact table\n(INSERT/REPLACE)"| T10
    ETL  -->|"Triggers"| KE
    KE   -->|"UPSERT results"| T11
    AE   -->|"UPSERT classifications"| T12
    AUTH -->|"INSERT/UPDATE/DELETE"| T13
    AUTH -->|"INSERT only"| T14

    KPI_R   -->|"SELECT"| T11
    P2P_R   -->|"SELECT"| T10
    CHAT_R  -->|"SELECT all tables"| T1 & T2 & T3 & T6 & T7 & T8 & T10 & T11
    AUDIT_R -->|"SELECT"| T14 & T13

    class ETL,KE,AE etlStyle
    class AUTH authStyle
    class KPI_R,P2P_R,CHAT_R,AUDIT_R apiStyle
    class T1,T2,T3,T4,T5,T6,T7,T8,T9,T10,T11,T12,T13,T14 dbStyle
```

---

## Section 12.1 — Conceptual / Logical Application Architecture

> 5-layer architecture: Users → Presentation (React SPA) → Application API (FastAPI) → Service Layer → Data Layer.  
> External integrations: SAP (file-based CSV) and OpenRouter API (REST HTTPS).

```mermaid
flowchart TD
    classDef userStyle  fill:#EBF5FB,stroke:#1565C0,color:#0A1E4A,stroke-width:2px
    classDef presStyle  fill:#D6EAF8,stroke:#1A5276,color:#0A2035,stroke-width:2px
    classDef apiStyle   fill:#E8F0FE,stroke:#1565C0,color:#0A1E4A,stroke-width:2px
    classDef svcStyle   fill:#D5F5E3,stroke:#1E6823,color:#0A2D0F,stroke-width:2px
    classDef dbStyle    fill:#F5EEF8,stroke:#512E5F,color:#2C0A3A,stroke-width:2px
    classDef extStyle   fill:#FADBD8,stroke:#C0392B,color:#1A0808,stroke-width:2px

    subgraph LAYER0["Users — KPMG Internal Staff (12 Roles)"]
        U1["Procurement Manager\nFinance User\nCompliance Officer"]
        U2["CXO · Leadership\nPartner · Director · Consultant"]
        U3["Admin · Delivery Manager"]
    end

    subgraph LAYER1["Presentation Layer — React SPA on Vercel / Azure Static Web Apps"]
        PR1["TanStack Router v1\nFile-based routes:\n/dashboard · /financial · /leadership\n/vendors · /utilization · /upload · /ask"]
        PR2["UI Components\nshadcn/ui + Radix UI\nTailwind CSS v3"]
        PR3["State Management\nTanStack Query v5 — server state\nAppContext — auth · theme · company filter"]
        PR4["Data Visualisation\nRecharts 2.x + Framer Motion"]
    end

    subgraph LAYER2["Application Layer — FastAPI REST API (Python 3.11 · Uvicorn)"]
        AP1["/api/kpi — KPI Router\nDashboard KPI reads"]
        AP2["/api/upload — ETL Router\nCSV ingestion + validation"]
        AP3["/api/auth — Auth Router\nUser CRUD · Login · RBAC"]
        AP4["/api/p2p — P2P Router\nLifecycle analytics"]
        AP5["/api/chat — AI Chat Router\nGPT-4o tool orchestration"]
        AP6["/api/events — Anomaly Router\nProcess mining events"]
        AP7["/api/actions — Actions Router\nRemediation tracking"]
    end

    subgraph LAYER3["Service Layer — Business Logic"]
        SV1["kpi_engine.py\n45 KPI computations\nacross 5 dashboards"]
        SV2["etl.py + fact_builder.py\nCSV parse · validate · load\nP2P fact table build"]
        SV3["chat_engine.py\nGPT-4o agentic loop\n6 tool definitions\nMax 3 tool calls per response"]
        SV4["validator.py\nSchema validation · mandatory fields\ncomposite key dedup · enum checks"]
        SV5["anomaly_engine\n12 PO risk variant classifiers\nMaverick · Split · Duplicate · SOD etc."]
    end

    subgraph LAYER4["Data Layer — PostgreSQL 15+ (Neon Serverless / Azure DB for PostgreSQL)"]
        DB1[("Procurement\npo_dump · pr_dump")]
        DB2[("Finance & Payments\ninvoice_dump · payment_dump\npo_invoice_dump")]
        DB3[("Operations\ngrn_dump · po_delivery_dump")]
        DB4[("Vendor\nvendor_master")]
        DB5[("Analytics\nkpi_results · process_mining_events\npr_po_grn_invoice")]
        DB6[("Platform\nusers · audit_log · change_log")]
    end

    subgraph EXTERNAL["External Systems"]
        EXT1["SAP ECC / S4HANA\nOn-Premise ERP\nFile-based CSV export"]
        EXT2["OpenRouter API\nopenrouter.ai\nGPT-4o — AI model"]
        EXT3["Azure AD\nKPMG SSO\nOAuth 2.0 / MFA\nTarget Architecture"]
    end

    LAYER0 -->|"HTTPS — Browser"| LAYER1
    LAYER1 <-->|"REST API — HTTPS/JSON\nBase URL: VITE_API_BASE_URL"| LAYER2
    LAYER2 --> LAYER3
    LAYER3 <-->|"psycopg3 — TLS 5432"| LAYER4
    EXT1   -->|"CSV batch upload"| AP2
    AP5    <-->|"HTTPS/JSON\nBEARER OPENROUTER_API_KEY"| EXT2
    EXT3   -->|"OAuth 2.0 tokens\nTarget Arch"| AP3

    class U1,U2,U3 userStyle
    class PR1,PR2,PR3,PR4 presStyle
    class AP1,AP2,AP3,AP4,AP5,AP6,AP7 apiStyle
    class SV1,SV2,SV3,SV4,SV5 svcStyle
    class DB1,DB2,DB3,DB4,DB5,DB6 dbStyle
    class EXT1,EXT2,EXT3 extStyle
```

---

## Section 12.4 — Application Architecture – Technology Stack

> Full bill-of-materials showing technology per application component.  
> All frontend and backend dependencies are open-source (MIT/BSD/PSF). Only OpenRouter API and Vercel are commercial.

```mermaid
flowchart LR
    classDef feStyle   fill:#D6EAF8,stroke:#1A5276,color:#0A2035,stroke-width:2px
    classDef beStyle   fill:#D5F5E3,stroke:#1E6823,color:#0A2D0F,stroke-width:2px
    classDef dbStyle   fill:#F5EEF8,stroke:#512E5F,color:#2C0A3A,stroke-width:2px
    classDef aiStyle   fill:#EBD5F7,stroke:#512E5F,color:#200A2A,stroke-width:2px
    classDef devStyle  fill:#FDEBD0,stroke:#7D4E05,color:#3D1F03,stroke-width:2px
    classDef azStyle   fill:#E8F0FE,stroke:#1565C0,color:#0A1E4A,stroke-width:2px

    subgraph FE["Frontend — Presentation Layer"]
        FE1["Language: TypeScript 5.x"]
        FE2["Framework: React 18.x"]
        FE3["Build Tool: Vite 5.x"]
        FE4["Routing: TanStack Router v1\n(file-based, type-safe)"]
        FE5["Server State: TanStack Query v5"]
        FE6["UI Components: shadcn/ui + Radix UI"]
        FE7["Styling: Tailwind CSS v3"]
        FE8["Charts: Recharts 2.x"]
        FE9["Animation: Framer Motion"]
        FE10["Package Manager: Bun 1.x"]
    end

    subgraph BE["Backend — Application Layer"]
        BE1["Language: Python 3.11+"]
        BE2["Framework: FastAPI (latest)"]
        BE3["ASGI Server: Uvicorn (latest)"]
        BE4["DB Adapter: psycopg3 3.x\n(postgresql driver)"]
        BE5["Excel: openpyxl"]
        BE6["HTTP Client: httpx\n(OpenRouter calls)"]
    end

    subgraph DB["Data Layer"]
        DB1["Database: PostgreSQL 15+"]
        DB2["Connection: Thread-local pool\n8 pre-warmed connections"]
        DB3["Cloud: Azure Database\nfor PostgreSQL Flexible Server\n(Target Architecture)"]
        DB4["Pilot: Neon Serverless\nPostgreSQL"]
    end

    subgraph AI["AI / LLM Layer"]
        AI1["Provider: OpenRouter API\n(openrouter.ai)"]
        AI2["Model: GPT-4o\n(openai/gpt-4o)"]
        AI3["Tools: 6 tool definitions\nquery_database · get_kpis\nfind_document · get_anomalies\nget_vendor_info · get_p2p_stage_summary"]
        AI4["Max tool calls: 3 per response"]
    end

    subgraph DEV["DevOps / Hosting"]
        DEV1["Source Control: GitHub\n(kpmg-intelliflow repo)"]
        DEV2["Frontend Host: Vercel CDN\n(auto-deploy on main push)"]
        DEV3["Backend Host: Azure Container Apps\n(Target Architecture)"]
        DEV4["Container Registry:\nAzure Container Registry"]
        DEV5["IDE: VS Code / Cursor"]
    end

    subgraph AZURE["Azure Security & Ops"]
        AZ1["Identity: Azure AD\nSSO + MFA — Target Arch"]
        AZ2["Secrets: Azure Key Vault\nDATABASE_URL · OPENROUTER_API_KEY\nJWT_SECRET"]
        AZ3["WAF: Azure Application Gateway"]
        AZ4["Monitoring: Azure Monitor\n+ Application Insights"]
        AZ5["Logs: Azure Log Analytics\n5-year audit log retention"]
    end

    FE <-->|"REST API HTTPS/JSON"| BE
    BE <-->|"psycopg3 TLS"| DB
    BE <-->|"HTTPS OpenRouter"| AI
    DEV -->|"Deploy & Host"| FE & BE
    AZURE -->|"Secure & Monitor"| BE & DB

    class FE1,FE2,FE3,FE4,FE5,FE6,FE7,FE8,FE9,FE10 feStyle
    class BE1,BE2,BE3,BE4,BE5,BE6 beStyle
    class DB1,DB2,DB3,DB4 dbStyle
    class AI1,AI2,AI3,AI4 aiStyle
    class DEV1,DEV2,DEV3,DEV4,DEV5 devStyle
    class AZ1,AZ2,AZ3,AZ4,AZ5 azStyle
```

---

## Section 13.1 — Integration Architecture – Solution Context

> IntelliSource integration context: SAP (file-based CSV batch), OpenRouter API (REST HTTPS), Azure AD (OAuth 2.0 Target), Vercel CDN (static hosting), GitHub (CI/CD).  
> All integrations are outbound from IntelliSource except SAP CSV push by admin.

```mermaid
flowchart LR
    classDef sapStyle    fill:#FADBD8,stroke:#C0392B,color:#1A0808,stroke-width:2px
    classDef isStyle     fill:#E8F0FE,stroke:#1565C0,color:#0A1E4A,stroke-width:2px
    classDef cloudStyle  fill:#D5F5E3,stroke:#1E6823,color:#0A2D0F,stroke-width:2px
    classDef kpmgStyle   fill:#EBD5F7,stroke:#512E5F,color:#200A2A,stroke-width:2px
    classDef futureStyle fill:#FEF9E7,stroke:#D4AC0D,color:#3D2B00,stroke-width:2px,stroke-dasharray:5 3

    subgraph KPMG_SYS["KPMG Internal Systems"]
        SAP["SAP ECC / S4HANA\nOn-Premise ERP\nSource of truth for P2P data"]
        AAD["Azure Active Directory\nKPMG Identity Provider\n12 Role Groups"]
        SD["KPMG IT Service Desk\nTier 1–2 Support"]
    end

    subgraph IS["IntelliSource Platform"]
        direction TB
        IS_UP["Upload Module\nPOST /api/upload\nCSV validation + ETL"]
        IS_KPI["KPI Engine\nGET /api/kpi\n45 pre-computed metrics"]
        IS_CHAT["AI Chat Engine\nPOST /api/chat\nGPT-4o agentic loop"]
        IS_AUTH["Auth Router\nPOST /api/auth/login\nRBAC · User CRUD"]
        IS_SPA["React SPA\nDashboards · Upload Portal\nAI Assistant UI"]
        IS_DB[("PostgreSQL\nNeon / Azure DB\n14 tables")]
        IS_UP --> IS_DB
        IS_KPI --> IS_DB
        IS_AUTH --> IS_DB
        IS_CHAT --> IS_DB
    end

    subgraph CLOUD["Cloud / External Services"]
        OR["OpenRouter API\nhttps://openrouter.ai\nGPT-4o — AI Model\nREST API — HTTPS/JSON\nPer-request commercial pricing"]
        VCL["Vercel Edge CDN\nhttps://vercel.com\nStatic SPA hosting\nAuto-deploy from GitHub"]
        GH["GitHub\ngithub.com/kpmg-intelliflow\nSource code + CI/CD\nAuto-deploy on push to main"]
    end

    subgraph FUTURE["Target Architecture Integrations (Planned)"]
        SAP_API["SAP BAPI / OData API\nReal-time data pull\nEliminate manual CSV step"]
        AZ_SSO["Azure AD SSO\nOAuth 2.0 / SAML\nMFA via Conditional Access"]
        AZ_ACA["Azure Container Apps\nDocker containerised backend"]
        AZ_DB["Azure Database\nfor PostgreSQL Flexible Server"]
    end

    SAP  -->|"File-based — Batch CSV\n9 SAP table dumps\nManual export by admin"| IS_UP
    AAD  -->|"OAuth 2.0 tokens — Target Arch\nRole group mapping"| IS_AUTH
    SD   -->|"Escalation via\nGitHub Issues"| IS
    IS_CHAT -->|"REST API HTTPS/JSON\nBEARER OPENROUTER_API_KEY\nPer-request · synchronous"| OR
    IS_SPA  -->|"CDN served static assets\nAuto-deploy on GitHub push"| VCL
    GH   -->|"main branch push\ntriggers Vercel deploy"| VCL
    GH   -->|"Docker image build\npush to Azure Container Registry"| AZ_ACA

    SAP_API -.->|"Planned\nTarget Arch"| IS_UP
    AZ_SSO  -.->|"Planned\nTarget Arch"| IS_AUTH
    AZ_ACA  -.->|"Replaces\ncurrent VM"| IS
    AZ_DB   -.->|"Replaces\nNeon DB"| IS_DB

    class SAP,AAD,SD kpmgStyle
    class IS_UP,IS_KPI,IS_CHAT,IS_AUTH,IS_SPA,IS_DB isStyle
    class OR,VCL,GH cloudStyle
    class SAP_API,AZ_SSO,AZ_ACA,AZ_DB futureStyle
    class SAP sapStyle
```

---

## Section 14.1 — Technology Architecture – Hosting / Deployment Architecture (Azure)

> Azure-based target deployment architecture.  
> Internet traffic flows through Azure Front Door / Application Gateway + WAF → Azure Container Apps (FastAPI) → Azure Database for PostgreSQL.  
> Frontend served via Azure Static Web Apps or Vercel CDN. Identity via Azure AD + MFA.

```mermaid
flowchart TD
    classDef userStyle  fill:#EBF5FB,stroke:#1565C0,color:#0A1E4A,stroke-width:2px
    classDef edgeStyle  fill:#D6EAF8,stroke:#1A5276,color:#0A2035,stroke-width:2px
    classDef appStyle   fill:#D5F5E3,stroke:#1E6823,color:#0A2D0F,stroke-width:2px
    classDef dataStyle  fill:#F5EEF8,stroke:#512E5F,color:#2C0A3A,stroke-width:2px
    classDef idStyle    fill:#EBD5F7,stroke:#512E5F,color:#200A2A,stroke-width:2px
    classDef opsStyle   fill:#FDEBD0,stroke:#7D4E05,color:#3D1F03,stroke-width:2px
    classDef extStyle   fill:#FADBD8,stroke:#C0392B,color:#1A0808,stroke-width:2px
    classDef ciStyle    fill:#FEF9E7,stroke:#D4AC0D,color:#3D2B00,stroke-width:2px

    subgraph USERS["Internet Zone — KPMG Users"]
        USR["KPMG Staff\nBrowser: Chrome · Edge · Firefox\n12 Roles · 20-50 concurrent users"]
        SAP_OP["SAP Operator\nCSV export + manual upload"]
    end

    subgraph AZURE_EDGE["Azure Edge / CDN Layer"]
        CDN["Azure Static Web Apps\nor Vercel Edge CDN\nReact SPA — static JS/CSS/HTML\nGlobal CDN edge caching"]
        AFD["Azure Front Door\nor Application Gateway\nSSL Termination · Load Balancing"]
        WAF["Azure WAF Policy\nOWASP rule set\nDDoS Protection Basic"]
    end

    subgraph AZURE_APP["Azure Application Zone — Azure Container Apps"]
        ACA_BE["FastAPI Container\nPython 3.11 · Uvicorn\nPort 8000 → internal only\nMin 1 replica · Max 5 replicas\nauto-scale on CPU/RPS"]
        ACR["Azure Container Registry\nDocker image store\n:latest · :release tags"]
        WORKER["Background Worker\nKPI recompute task\nFastAPI BackgroundTasks\nTransition 1 roadmap"]
    end

    subgraph AZURE_DATA["Azure Data Zone"]
        PGDB["Azure Database for PostgreSQL\nFlexible Server — PostgreSQL 15+\nSKU: General Purpose 4 vCores\nStorage: 64 GB · Auto-grow\nTLS enforced · Private VNet endpoint\n14 tables · Est. 5-20 GB/year"]
        KV["Azure Key Vault\nSecrets:\nDATABASE_URL\nOPENROUTER_API_KEY\nJWT_SECRET_KEY\nKPMG_SSO_CLIENT_SECRET"]
        BACKUP["Azure Backup\nNightly pg_dump to\nAzure Blob Storage\nRetention: 7 years (procurement)\n5 years (audit log)"]
    end

    subgraph AZURE_ID["Azure Identity — Azure Active Directory"]
        AAD["Azure AD Tenant\nKPMG Identity Provider\nUser directory — 12 role groups\nConditional Access Policies\nMFA enforcement"]
        APPREG["App Registration\nIntelliSource OAuth 2.0 client\nclient_id · client_secret\nredirect_uri · OIDC scopes"]
    end

    subgraph AZURE_OPS["Azure Operations & Monitoring"]
        MON["Azure Monitor\n+ Application Insights\nAPM · Request tracing\nDependency maps\nPerformance counters"]
        LOG["Azure Log Analytics Workspace\nApp logs · Audit trail\nPostgreSQL slow queries\nAlert rules: RTO breach · error spike"]
        ALERTS["Azure Alerts\nEmail / Teams notification\non P99 latency · error rate\n· DB connection exhaustion"]
    end

    subgraph CICD["CI/CD Pipeline — GitHub Actions / Azure DevOps"]
        GH["GitHub Repository\nkpmg-intelliflow\nmain branch"]
        PIPE_FE["Frontend Pipeline\ngit push → Vercel auto-deploy\nor Azure Static Web Apps CI"]
        PIPE_BE["Backend Pipeline\ndocker build · docker push ACR\naz containerapp update"]
    end

    subgraph EXTERNAL["External Services"]
        OR["OpenRouter API\nhttps://openrouter.ai\nGPT-4o — AI assistant\nOutbound HTTPS 443\nCommercial pay-per-use"]
        SAP_SRC["SAP ECC / S4HANA\nOn-Premise\nCSV export — manual batch"]
    end

    USR      -->|"HTTPS 443\nBrowser request"| CDN
    USR      -->|"HTTPS 443\nAPI calls"| AFD
    SAP_OP   -->|"CSV file upload\nHTTPS POST /api/upload"| AFD
    CDN      -->|"SPA calls backend API"| AFD
    AFD      --> WAF
    WAF      -->|"Allowed traffic\nHTTPS internal"| ACA_BE
    ACA_BE   <-->|"psycopg3 TLS\nPort 5432\nPrivate VNet"| PGDB
    ACA_BE   -->|"Read secrets\nManaged Identity"| KV
    ACA_BE   <-->|"HTTPS 443\nBEARER token"| OR
    AAD      <-->|"OAuth 2.0\nid_token · access_token"| APPREG
    APPREG   -->|"JWT validation\nRole mapping"| ACA_BE
    GH       -->|"Push triggers"| PIPE_FE & PIPE_BE
    PIPE_BE  -->|"Docker push"| ACR
    ACR      -->|"Pull on revision deploy"| ACA_BE
    PIPE_FE  -->|"Deploy static assets"| CDN
    ACA_BE   -->|"Telemetry · traces"| MON
    ACA_BE   -->|"App logs"| LOG
    PGDB     -->|"Query logs"| LOG
    LOG      --> ALERTS
    PGDB     -->|"Scheduled backup"| BACKUP
    SAP_SRC  -->|"Manual CSV export\nby admin"| SAP_OP

    class USR,SAP_OP userStyle
    class CDN,AFD,WAF edgeStyle
    class ACA_BE,ACR,WORKER appStyle
    class PGDB,KV,BACKUP dataStyle
    class AAD,APPREG idStyle
    class MON,LOG,ALERTS opsStyle
    class OR,SAP_SRC extStyle
    class GH,PIPE_FE,PIPE_BE ciStyle
```

---

## Section 15.1 — Security – Authentication

> Baseline: custom email + password auth (plaintext — pilot only, bcrypt REQUIRED before production).  
> Production: bcrypt (cost factor 12) + JWT (15-min access + 7-day refresh).  
> Target Architecture: KPMG Azure AD SSO via OAuth 2.0 Authorization Code Flow + MFA via Conditional Access.

```mermaid
sequenceDiagram
    actor User as KPMG User
    participant SPA as React SPA
    participant API as FastAPI /api/auth
    participant DB as PostgreSQL users table
    participant AAD as Azure AD (Target Arch)
    participant KV as Azure Key Vault

    Note over User,KV: ── BASELINE: Email + Password Auth (Current Pilot) ──

    User->>SPA: Enter email + password on /login
    SPA->>API: POST /api/auth/login { email, password }
    API->>DB: SELECT user_id, full_name, role, password, is_active FROM users WHERE email = ?
    DB-->>API: User row
    API->>API: Pilot: plaintext compare (password == db.password)\nPRODUCTION: bcrypt.verify(password, db.password_hash)\ncost factor = 12
    alt Credentials valid AND is_active = true
        API->>DB: INSERT INTO audit_log (user_id, action='LOGIN', ...)
        API-->>SPA: 200 OK { user_id, email, full_name, role }
        SPA->>SPA: Store in React AppContext\n(currently localStorage)\nPRODUCTION: in-memory only (XSS safe)
        SPA-->>User: Redirect to /dashboard
    else Invalid credentials OR inactive
        API-->>SPA: 401 Unauthorized { detail: "Invalid credentials" }
        SPA-->>User: Show error — "Invalid email or password"
    end

    Note over User,KV: ── PRODUCTION ADD-ON: JWT Token issuance ──

    API->>KV: Read JWT_SECRET_KEY (Managed Identity)
    KV-->>API: Secret value
    API->>API: jwt.encode({ sub: user_id, role: role, exp: now+15min })
    API-->>SPA: { access_token (15 min), refresh_token (7 days) }
    SPA->>SPA: Store access_token in memory\nStore refresh_token in HttpOnly cookie

    Note over User,KV: ── TARGET ARCHITECTURE: Azure AD SSO + MFA ──

    User->>SPA: Click "Sign in with KPMG SSO"
    SPA->>AAD: Redirect to Azure AD\nOAuth 2.0 Authorization Code Flow\nscopes: openid profile email\nclient_id from App Registration
    AAD->>User: KPMG login page + MFA prompt\n(Conditional Access Policy)
    User->>AAD: KPMG credentials + MFA token (Authenticator App)
    AAD-->>SPA: Authorization Code (short-lived)
    SPA->>API: POST /api/auth/sso { code, redirect_uri }
    API->>AAD: POST token endpoint\nexchange code for id_token + access_token
    AAD-->>API: id_token (JWT) containing email, name, AD groups
    API->>API: Map AD group → IntelliSource role\nUpsert user record in PostgreSQL
    API->>DB: INSERT INTO audit_log (action='SSO_LOGIN', ...)
    API->>KV: Read JWT_SECRET_KEY
    API-->>SPA: IntelliSource JWT access_token (15 min)\n+ refresh_token (7 days, HttpOnly cookie)
    SPA-->>User: Redirect to /dashboard
```

---

## Section 15.2 — Security – Authorization

> Role-Based Access Control (RBAC) with 12 predefined roles.  
> Baseline: role checked at frontend route level only.  
> Production requirement: JWT claims validated server-side on every API call.

```mermaid
flowchart TD
    classDef roleStyle  fill:#D6EAF8,stroke:#1A5276,color:#0A2035,stroke-width:2px
    classDef gateStyle  fill:#FEF9E7,stroke:#D4AC0D,color:#3D2B00,stroke-width:2px
    classDef allowStyle fill:#D5F5E3,stroke:#1E6823,color:#0A2D0F,stroke-width:2px
    classDef denyStyle  fill:#FADBD8,stroke:#C0392B,color:#1A0808,stroke-width:2px
    classDef routeStyle fill:#EBF5FB,stroke:#1565C0,color:#0A1E4A,stroke-width:2px
    classDef apiStyle   fill:#E8F0FE,stroke:#1565C0,color:#0A1E4A,stroke-width:2px
    classDef auditStyle fill:#F5EEF8,stroke:#512E5F,color:#2C0A3A,stroke-width:2px

    subgraph ROLES["Authenticated Users — 12 Roles"]
        R_ADMIN["Admin"]
        R_PROC["Procurement Manager"]
        R_FIN["Finance User"]
        R_COMP["Compliance Officer"]
        R_CXO["CXO / Leadership"]
        R_LEAD["Leadership"]
        R_PART["Partner"]
        R_DIR["Director"]
        R_ADIR["Associate Director"]
        R_MGR["Manager"]
        R_CONS["Consultant"]
        R_DM["Delivery Manager"]
    end

    subgraph GATE["Authorization Gate"]
        JWT_CHECK{"Validate JWT\nRSA signature\nExpiry check\nRole claim extraction"}
        ROUTE_CHECK{"Frontend Route\nRole Guard\nTanStack Router\nbeforeLoad hook"}
        API_CHECK{"Backend API\nRole Middleware\nTarget Architecture\nFastAPI Depends"}
    end

    subgraph FRONTEND_ROUTES["Protected Frontend Routes"]
        RT_DASH["/dashboard\nProcurement KPIs\nAll roles READ"]
        RT_FIN["/financial\nFinancial KPIs\nAll roles READ"]
        RT_LEAD["/leadership\nLeadership KPIs\nAll roles READ"]
        RT_VEND["/vendors\nVendor KPIs\nAll roles READ"]
        RT_UTIL["/utilization\nUtilization KPIs\nAll roles READ"]
        RT_UPLOAD["/upload\nCSV Data Upload\nAdmin ONLY"]
        RT_ASK["/ask\nAI Assistant\nAll roles"]
        RT_ADMIN["/admin/*\nUser Management\nAdmin ONLY"]
        RT_ACT["/actions\nRemediation Tracker\nAdmin · Procurement · Compliance"]
    end

    subgraph API_PERMS["API Endpoint Permissions"]
        AP1["GET /api/kpi/**\nAll roles — READ"]
        AP2["POST /api/upload\nAdmin ONLY"]
        AP3["POST /api/kpi/recompute\nAdmin ONLY"]
        AP4["GET /api/p2p/**\nAll roles — READ"]
        AP5["GET /api/events/**\nAdmin · Procurement\nCompliance — READ"]
        AP6["POST /api/auth/users\nAdmin ONLY"]
        AP7["PUT /api/auth/users/:id\nAdmin ONLY"]
        AP8["POST /api/auth/users/:id/reset-password\nAdmin ONLY"]
        AP9["POST /api/chat\nAll roles"]
    end

    subgraph AUDIT["Audit Trail — audit_log table"]
        AUD["All authorisation events logged:\nLOGIN · LOGOUT · ROLE_SWITCH\nUSER_CREATED · USER_UPDATED\nPASSWORD_RESET · DATA_UPLOAD\nTimestamp · user_id · action · details"]
    end

    ROLES --> JWT_CHECK
    JWT_CHECK -->|"Valid JWT + role"| ROUTE_CHECK
    JWT_CHECK -->|"Invalid / expired"| DENY["Redirect to /login\n401 Unauthorized"]
    ROUTE_CHECK -->|"Role permitted"| FRONTEND_ROUTES
    ROUTE_CHECK -->|"Role not permitted"| DENY403["403 Forbidden\nRedirect to /dashboard"]
    API_CHECK -->|"Role claim OK"| API_PERMS
    API_CHECK -->|"Role claim denied"| DENY_API["403 Forbidden\n{ detail: 'Insufficient role' }"]
    FRONTEND_ROUTES --> API_CHECK
    API_PERMS --> AUDIT
    DENY --> AUDIT
    DENY403 --> AUDIT

    R_ADMIN --->|"All access"| RT_UPLOAD & RT_ADMIN
    R_PROC --->|"Primary"| RT_DASH & RT_VEND
    R_FIN --->|"Primary"| RT_FIN & RT_UTIL
    R_COMP --->|"Primary"| RT_VEND & RT_LEAD
    R_CXO & R_LEAD & R_PART & R_DIR & R_ADIR --->|"Executive"| RT_LEAD
    R_DM --->|"Primary"| RT_UTIL

    class R_ADMIN,R_PROC,R_FIN,R_COMP,R_CXO,R_LEAD,R_PART,R_DIR,R_ADIR,R_MGR,R_CONS,R_DM roleStyle
    class JWT_CHECK,ROUTE_CHECK,API_CHECK gateStyle
    class RT_DASH,RT_FIN,RT_LEAD,RT_VEND,RT_UTIL,RT_UPLOAD,RT_ASK,RT_ADMIN,RT_ACT routeStyle
    class AP1,AP2,AP3,AP4,AP5,AP6,AP7,AP8,AP9 apiStyle
    class AUD auditStyle
    class DENY,DENY403,DENY_API denyStyle
```

---

## Section 19 — Solution Compliance – Enterprise Architecture Principles

> IntelliSource compliance against 10 KPMG EA Architecture Principles.  
> 8 of 10 compliant. 1 partial (mobile — Transition 1 roadmap). 1 non-compliant with justification (off-the-shelf integration not used; custom API justified by SAP-specific data model).

```mermaid
flowchart LR
    classDef compliant fill:#D5F5E3,stroke:#1E6823,color:#0A2D0F,stroke-width:2px
    classDef partial   fill:#FDEBD0,stroke:#7D4E05,color:#3D1F03,stroke-width:2px
    classDef noncmply  fill:#FADBD8,stroke:#C0392B,color:#1A0808,stroke-width:2px
    classDef header    fill:#0D1F35,stroke:#0D1F35,color:#FFFFFF,stroke-width:0,font-weight:bold

    subgraph INTELLISOURCE["IntelliSource — EA Principles Compliance"]

        subgraph BA["Business Architecture"]
            BA1["✅ SINGLE CAPABILITY\nIntelliSource has one well-defined\npurpose: P2P procurement intelligence.\nNo scope creep into HR/Finance systems."]
            BA2["✅ UNIFIED ARCHITECTURE GOVERNANCE\nSubmitted to ARB for formal review.\nSolution architecture follows KPMG EA\nstandards and review process."]
        end

        subgraph INTA["Integration Architecture"]
            INT1["✅ API FIRST\nAll backend functionality exposed\nvia FastAPI REST API.\nFrontend is a first-class consumer.\nNo direct DB access from SPA."]
            INT2["✅ GOVERNED INTEGRATION\nSAP integration (file-based CSV)\nand OpenRouter (REST) are fully\ndocumented, controlled, and versioned."]
            INT3["❌ LEVERAGE OFF-THE-SHELF INTEGRATION\nCustom FastAPI REST layer preferred\nover integration middleware.\nJUSTIFICATION: SAP-specific 14-table\ndata model + 45 custom KPIs cannot\nbe expressed in off-the-shelf tools.\nPrefers custom API for full control."]
        end

        subgraph IA["Information Architecture"]
            IA1["✅ DATA IS AN ASSET\nAll procurement data modelled in\nPostgreSQL with defined retention:\n7 years (transactional)\n5 years (audit logs)\nArchiving and CRUD policies defined."]
        end

        subgraph APPA["Application Architecture"]
            APP1["✅ CONFIGURE, DO NOT CUSTOMIZE\nKPI thresholds, company codes,\nhigh-value PO limits configurable\nvia Admin Settings UI.\nNo code changes required for config."]
            APP2["⚠️ THINK MOBILITY FOR FRONT-END\nCurrent UI is desktop-first.\nShadcn/ui and Tailwind support\nmobile-responsive layout.\nROADMAP: Transition 1 (Jul–Sep 2026)\nwill deliver mobile-responsive views."]
        end

        subgraph TA["Technology Architecture"]
            T1["✅ VIRTUAL DEPLOYMENT PREFERRED\nFrontend: Vercel serverless CDN.\nBackend: Docker containers →\nAzure Container Apps (Transition 1).\nNo bare-metal servers."]
            T2["✅ THINK CLOUD FIRST\nFrontend on Vercel cloud CDN.\nPostgreSQL: Neon serverless (pilot) →\nAzure Database for PostgreSQL (target).\nAll secrets in Azure Key Vault."]
        end

    end

    subgraph LEGEND["Legend"]
        LG1["✅ Compliant — 8 of 10 principles"]
        LG2["⚠️ Partial — 1 principle (Transition 1 roadmap)"]
        LG3["❌ Non-Compliant with justification — 1 principle"]
    end

    class BA1,BA2,INT1,INT2,IA1,APP1,T1,T2 compliant
    class APP2 partial
    class INT3 noncmply
    class LG1 compliant
    class LG2 partial
    class LG3 noncmply
```

---

## Diagram Index

| # | ARB Section | Mermaid Diagram Type | Status |
|---|---|---|---|
| 1 | 7.1 Business Process (To-Be) | `flowchart TD` — swimlanes | ✅ |
| 2 | 7.2 Business Process (As-Is) | `flowchart TD` — swimlanes + gaps | ✅ |
| 3 | 11.3 Information Architecture – Conceptual Data Model | `erDiagram` — 14 entities | ✅ |
| 4 | 11.4 Information Architecture – Data/CRUD Model | `flowchart LR` — CRUD mapping | ✅ |
| 5 | 12.1 Conceptual/Logical Application Architecture | `flowchart TD` — 5 layers | ✅ |
| 6 | 12.4 Application Architecture – Technology Stack | `flowchart LR` — tech BOM | ✅ |
| 7 | 13.1 Integration Architecture – Solution Context | `flowchart LR` — integration context | ✅ |
| 8 | 14.1 Technology Architecture – Hosting/Deployment (Azure) | `flowchart TD` — Azure zones | ✅ |
| 9 | 15.1 Security – Authentication | `sequenceDiagram` — Baseline + Target | ✅ |
| 10 | 15.2 Security – Authorization | `flowchart TD` — RBAC flow | ✅ |
| 11 | 19. Solution Compliance – EA Principles | `flowchart LR` — compliance status | ✅ |
