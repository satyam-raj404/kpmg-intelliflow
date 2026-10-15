# IntelliSource Documentation

Everything in this folder. Grouped by lifecycle:

| Folder | What lives there | Treat it as |
|---|---|---|
| [`FEATURES.md`](FEATURES.md) | What the application does, end to end | **Start here** if you are new |
| [`reference/`](reference/) | Technical, functional and KPI reference | Living docs — read when the task touches that area |
| [`architecture/`](architecture/) | Architecture Review Board submission + Mermaid diagrams | Frozen submission artefact |
| [`deliverables/`](deliverables/) | Presentations, decks and pitch scripts | Frozen submission artefact |
| [`assets/`](assets/) | Application screenshots | Frozen submission artefact |

---

## Entry point

| Document | What it covers |
|---|---|
| [FEATURES.md](FEATURES.md) | Every page, dashboard, KPI, the P2P lifecycle, process mining, the AI harness, reports, and a candid list of what is advertised but not implemented. |
| [../AGENTS.md](../AGENTS.md) | Conventions, verification commands, and the silent-failure traps — read this before changing code. |
| [../README.md](../README.md) | User-facing pitch and quick start. |

---

## Reference

### Architecture and engineering

| Document | What it covers |
|---|---|
| [TECHNICAL_DOCUMENTATION.md](reference/TECHNICAL_DOCUMENTATION.md) | Architecture, API reference, database schema, design decisions. |
| [SKILL_IntelliSource.md](reference/SKILL_IntelliSource.md) | The P2P lifecycle in 16 stages, full DDL, and the ETL pipeline contract. |
| [P2P_Data_Model_ER.md](reference/P2P_Data_Model_ER.md) | ER reference for the P2P data model. |
| [P2P_Simplified_Model_Review.md](reference/P2P_Simplified_Model_Review.md) | A stripped-down model, with every cut justified. |

### Ask IntelliSource (the AI agent)

| Document | What it covers |
|---|---|
| [ASK_INTELLISOURCE_HARNESS_PLAN.md](reference/ASK_INTELLISOURCE_HARNESS_PLAN.md) | Harness design: the three-tier loop, tools, guardrails, the read-only DB role. Cited directly from `orchestrator.py`, `harness_db.py` and `guardrails.py`. |
| [ASK_INTELLISOURCE_OPTIMIZATION_PLAN.md](reference/ASK_INTELLISOURCE_OPTIMIZATION_PLAN.md) | The accuracy/performance optimisation plan referenced by `orchestrator.py`. |

### SAP mapping and KPI SQL

| Document | What it covers |
|---|---|
| [SAP_FUNCTIONAL_DOCUMENTATION.md](reference/SAP_FUNCTIONAL_DOCUMENTATION.md) | SAP MM/FI field → column mapping, KPI SQL, CAPEX/OPEX logic. |
| [PROCUREMENT_KPI_QUERIES.md](reference/PROCUREMENT_KPI_QUERIES.md) | Procurement dashboard KPI SQL with SAP source tables. |
| [finance.md](reference/finance.md) | Financial dashboard KPI SQL. |
| [UTILIZATION_KPI_REFERENCE.md](reference/UTILIZATION_KPI_REFERENCE.md) | Utilization dashboard KPI reference. |
| [Utilization_CAPEXOPEX.md](reference/Utilization_CAPEXOPEX.md) | The software/material extension to the utilization KPIs. |
| [VendorD.md](reference/VendorD.md) | Vendor dashboard KPI documentation. |
| [Hashmap.md](reference/Hashmap.md) | SAP field hashmap reference (63 KB, machine-generated). |

### Business requirements

| Document | What it covers |
|---|---|
| [BRD_Summary_IntelliSource.md](reference/BRD_Summary_IntelliSource.md) | Business Requirements Document summary. |
| [BRD_Security_Requirements_Addendum.md](reference/BRD_Security_Requirements_Addendum.md) | Security posture. **Note: describes requirements the code does not yet implement.** |

### Leadership

| Document | What it covers |
|---|---|
| [Leadership.md](reference/Leadership.md) | Leadership dashboard brief (28 KB). |
| [1_Leadership.md](reference/1_Leadership.md) | An earlier, shorter draft of the same (16 KB). **Both are retained pending a decision on which is canonical.** |

---

## Architecture — ARB submission

[`architecture/ar-submission/`](architecture/ar-submission/) holds the Architecture Review Board
submission: the filled Word documents, 11 Mermaid architecture diagrams (`D01`–`D11`) with their
rendered PNGs under `Diagrams/`, the KPI workbook, the AI/ARB narrative, the video script, and the
demo video production guide.

These are **frozen submission artefacts**. They describe the system as it was submitted; they are not
maintained alongside code changes.

Regenerate the AI-flavoured ARB document with:

```bash
python docs/architecture/ar-submission/build_ai_arb.py
```

[`architecture/diagrams/`](architecture/diagrams/) holds the P2P data-model Mermaid source.

---

## Deliverables — decks and scripts

[`deliverables/presentations/`](deliverables/presentations/) holds the KPMG-branded decks
(intro presentation, pitch, case study, AI roadmap) and `P2P_Data_Model.xlsx`.

[`deliverables/Pitch.md`](deliverables/Pitch.md) and
[`deliverables/Presentation_Script.md`](deliverables/Presentation_Script.md) are the narrative and
presenter script that go with the decks.

The decks are regenerated from [`../tools/`](../tools/) — `build_presentation_pptx.py`,
`build_pitch_pptx.py`, `build_case_study_pptx.py`, `build_case_study_ribbon_pptx.py`,
`build_ai_features_pptx.py`. `build_presentation_pptx.py` reads the screenshots from
[`assets/screenshots/`](assets/screenshots/).

---

## Assets

[`assets/screenshots/`](assets/screenshots/) holds the 15 application screenshots (plus one
`IntelliSource_Application_Demo.docx`) captured for the submission. Consumed by
`tools/build_presentation_pptx.py`.

---

## Contributing to these docs

- `reference/` is maintained. Update it when behaviour changes.
- `architecture/` and `deliverables/` are frozen. Change them only as part of a new submission.
- Code comments and docstrings that name a file path should use the path as it is **after** the
  2026 reorganisation: `tools/` for generators, `docs/reference/` for living docs,
  `docs/architecture/` for the ARB submission. Several pre-reorganisation paths were corrected in
  the same pass, but new references should not reintroduce them.