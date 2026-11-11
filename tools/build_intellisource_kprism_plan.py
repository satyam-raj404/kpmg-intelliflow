"""Builds the simplified IntelliSource-to-KPRISM 3-month plan.

Outputs:
  docs/planning/intellisource-kprism-integration/Project_Plan_IntelliSource_to_KPRISM.docx
  docs/planning/intellisource-kprism-integration/Project_Plan_IntelliSource_to_KPRISM.xlsx

The workbook is deliberately a single sheet: a 13-week timeline.

Run with a Python that has python-docx and openpyxl installed:
  python tools/build_intellisource_kprism_plan.py
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.properties import PageSetupProperties


# ---------------------------------------------------------------------------
# The plan
# ---------------------------------------------------------------------------

START = date(2026, 11, 9)
WEEKS = 13
END = START + timedelta(days=WEEKS * 7 - 3)  # Friday 5 February 2027

BLUE = "00338D"
MID_BLUE = "0091DA"
GREY = "5A6B7B"
LIGHT_BLUE = "EAF2FB"
LIGHT_GREY = "F2F4F7"
WHITE = "FFFFFF"
GOLD = "B8860B"


def week_start(week: int) -> date:
    return START + timedelta(days=7 * (week - 1))


def week_end(week: int) -> date:
    return week_start(week) + timedelta(days=4)  # Friday


def dt(value: date, with_year: bool = False) -> str:
    text = f"{value.day} {value.strftime('%b')}"
    return f"{text} {value.year}" if with_year else text


PHASES = [
    {
        "name": "Set-up and secure shell",
        "start": 1,
        "end": 2,
        "colour": "6B7280",
        "outcome": "Sign-in, project access and the module shell are working in test.",
    },
    {
        "name": "Vendor Repository",
        "start": 3,
        "end": 5,
        "colour": "0091DA",
        "outcome": "Vendor list, detail, contacts and notes are released.",
    },
    {
        "name": "Profit Centre",
        "start": 5,
        "end": 9,
        "colour": "470A68",
        "outcome": "Master data, budgets and budget versus actual are released.",
    },
    {
        "name": "Contract Register",
        "start": 8,
        "end": 10,
        "colour": "C6007E",
        "outcome": "Contract list, detail, status and expiry are released.",
    },
    {
        "name": "Assistant upgrade",
        "start": 3,
        "end": 11,
        "colour": "00A3A1",
        "outcome": "Exports, chart follow-up and the agreed questions are released.",
    },
    {
        "name": "Hardening and launch",
        "start": 12,
        "end": 13,
        "colour": "8A8D8F",
        "outcome": "Security, training, go-live and first-week support are complete.",
    },
]

# id, phase, task, owner, start week, end week, milestone
TASKS = [
    ("T01", "Set-up and secure shell", "Confirm scope, access rule and success measures", "Project lead", 1, 1, False),
    ("T02", "Set-up and secure shell", "Set up environments and the module skeleton", "DevOps + backend", 1, 1, False),
    ("T03", "Set-up and secure shell", "Add KPRISM sign-in and project-only access", "Backend", 2, 2, False),
    ("T04", "Set-up and secure shell", "Create module database and read-only project connection", "Data + backend", 2, 2, False),

    ("T05", "Vendor Repository", "Design vendor data and module tables", "Data engineer", 3, 3, False),
    ("T06", "Vendor Repository", "Build vendor list, search and detail", "Frontend + backend", 3, 4, False),
    ("T07", "Vendor Repository", "Add contacts, notes and manual import", "Backend + frontend", 4, 4, False),
    ("T08", "Vendor Repository", "Vendor QA and user acceptance", "QA + business analyst", 5, 5, False),
    ("R1", "Vendor Repository", "Release 1 — Vendor Repository", "DevOps", 5, 5, True),

    ("T09", "Profit Centre", "Design profit centre and budget tables", "Data engineer", 5, 5, False),
    ("T10", "Profit Centre", "Build profit centre screens and budget entry", "Frontend + backend", 6, 7, False),
    ("T11", "Profit Centre", "Connect budget versus actual", "Data + backend", 7, 8, False),
    ("T12", "Profit Centre", "Profit centre QA and user acceptance", "QA + business analyst", 9, 9, False),
    ("R2", "Profit Centre", "Release 2 — Profit Centre", "DevOps", 9, 9, True),

    ("T13", "Contract Register", "Design contract register tables", "Data engineer", 8, 8, False),
    ("T14", "Contract Register", "Build contract list, detail and status", "Backend + frontend", 8, 9, False),
    ("T15", "Contract Register", "Add expiry view and optional PO link", "Backend", 9, 10, False),
    ("T16", "Contract Register", "Contract QA and user acceptance", "QA + business analyst", 10, 10, False),
    ("R3", "Contract Register", "Release 3 — Contract Register", "DevOps", 10, 10, True),

    ("T17", "Assistant upgrade", "Agree 8–10 questions and connect KPRISM's AI service", "AI developer", 3, 3, False),
    ("T18", "Assistant upgrade", "Add Excel, PDF and PowerPoint exports", "AI + backend", 4, 6, False),
    ("T19", "Assistant upgrade", "Add chart follow-up and multi-step answers", "AI developer", 7, 9, False),
    ("T20", "Assistant upgrade", "Add vendor, profit centre and contract tools", "AI + backend", 9, 10, False),
    ("T21", "Assistant upgrade", "Assistant safety checks and user testing", "AI + security + BA", 11, 11, False),
    ("R4", "Assistant upgrade", "Release 4 — Upgraded assistant", "DevOps", 11, 11, True),

    ("T22", "Hardening and launch", "Security and performance checks", "Security + DevOps", 12, 12, False),
    ("T23", "Hardening and launch", "User guide, training and pilot", "Business analyst + project lead", 12, 13, False),
    ("T24", "Hardening and launch", "Go-live, hypercare and close", "DevOps + project lead", 13, 13, False),
]

RELEASES = [
    ("R1", "Vendor Repository", 5,
     "List, search, detail, contacts, notes and manual import.",
     "UAT sign-off; no high defects."),
    ("R2", "Profit Centre", 9,
     "Master data, yearly budgets and budget versus actual.",
     "Reconciles for three sample projects; UAT sign-off."),
    ("R3", "Contract Register", 10,
     "List, detail, status, expiry view and optional PO link.",
     "UAT sign-off; expiry view tested."),
    ("R4", "Upgraded assistant", 11,
     "Exports, chart follow-up, 8–10 agreed questions and module tools.",
     "8 of 10 questions pass; exports open."),
]

TEAM = [
    ("Project lead", "50%", "Plan, risks, decisions and stakeholder communication."),
    ("Business analyst", "40%", "Scope, user acceptance tests and training."),
    ("Backend developer", "100%", "Sign-in, data rules and module services."),
    ("Frontend developer", "100%", "Screens and KPRISM look and feel."),
    ("AI developer", "90%", "Assistant upgrade, AI connection and module tools."),
    ("Data engineer", "50%", "Module database and project data."),
    ("QA tester", "50%", "Testing and user acceptance support."),
    ("Security reviewer", "20% for 6 weeks", "Security review and fixes."),
    ("DevOps engineer", "25%", "Environments, releases and go-live."),
]

RISKS = [
    ("Team pulled onto other work", "Protect three full-time roles; raise it in the weekly meeting."),
    ("Project data is missing or different", "Check in week 1; use manual import or a budget-only view."),
    ("Assistant accuracy", "Agree 8–10 questions up front; test weekly; stop at the agreed scope."),
    ("Sign-in or project access gap", "Week 2 gate: no further build until it passes."),
    ("Year-end holidays", "No releases in weeks 7–8; those weeks are low-capacity."),
    ("Scope grows", "Monthly steering; any addition moves a release date."),
]

SUCCESS = [
    ("One sign-in", "Users reach all modules from KPRISM without a second login."),
    ("Project access", "Each user sees only the projects assigned to them."),
    ("Vendor search", "A 5,000-vendor list opens in under 3 seconds."),
    ("Profit centre", "Budget versus actual reconciles for three sample projects."),
    ("Contracts", "Create, edit, expire and see contracts 30 days ahead."),
    ("Assistant", "8 of 10 agreed questions answered correctly; exports open."),
    ("Security", "No high-severity findings open at go-live."),
]

SCOPE_OUT = [
    "IntelliSource procurement dashboards, KPI calculations, SAP upload and purchase-to-pay pages.",
    "IntelliSource user management, signup and demo accounts.",
    "A second AI assistant.",
    "New SAP extraction, data warehouse work or major data cleansing.",
    "Mobile application.",
    "Major changes to KPRISM's Java application or existing screens.",
    "Full document management or OCR for vendor and contract files.",
    "Complex approval workflows and advanced contract matching.",
]


# ---------------------------------------------------------------------------
# Word helpers
# ---------------------------------------------------------------------------

def shade(cell, colour: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), colour)
    tc_pr.append(shd)


def table_borders(table, colour: str = "D0D7E5", size: str = "4"):
    tbl_pr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), size)
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), colour)
        borders.append(el)
    tbl_pr.append(borders)


def no_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "nil")
        borders.append(el)
    tbl_pr.append(borders)


def cell_margins(table, top=40, bottom=40, left=80, right=80):
    tbl_pr = table._tbl.tblPr
    mar = OxmlElement("w:tblCellMar")
    for side, width in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:w"), str(width))
        el.set(qn("w:type"), "dxa")
        mar.append(el)
    tbl_pr.append(mar)


def repeat_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    header = OxmlElement("w:tblHeader")
    header.set(qn("w:val"), "true")
    tr_pr.append(header)


def cant_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    tr_pr.append(OxmlElement("w:cantSplit"))


def heading(doc, text: str):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(15)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(14)
    r.font.color.rgb = RGBColor(0x00, 0x33, 0x8D)
    p_pr = p._p.get_or_add_pPr()
    bdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "8")
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), "0091DA")
    bdr.append(bottom)
    p_pr.append(bdr)
    return p


def subheading(doc, text: str):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(11.5)
    r.font.color.rgb = RGBColor(0x00, 0x5A, 0x9E)
    return p


def body(doc, text: str, size: float = 10.5, colour: str | None = None, space_after: int = 5):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.12
    r = p.add_run(text)
    r.font.size = Pt(size)
    if colour:
        r.font.color.rgb = RGBColor.from_string(colour)
    return p


def bullets(doc, items, size: float = 10.5):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.1
        r = p.add_run(item)
        r.font.size = Pt(size)


def table(doc, headers, rows, widths, font_size: float = 9, first_col_bold: bool = False,
          centre_cols=(), zebra: bool = True):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    table_borders(t)
    cell_margins(t)

    header = t.rows[0]
    repeat_header(header)
    cant_split(header)
    for i, text in enumerate(headers):
        cell = header.cells[i]
        cell.text = ""
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(text)
        r.bold = True
        r.font.size = Pt(font_size)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        shade(cell, BLUE)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        if i in centre_cols:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        cant_split(t.rows[-1])
        for i, value in enumerate(row):
            cell = cells[i]
            cell.text = ""
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(str(value))
            r.font.size = Pt(font_size)
            if first_col_bold and i == 0:
                r.bold = True
            if zebra and ri % 2 == 1:
                shade(cell, "F4F7FB")
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            if i in centre_cols:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    for row in t.rows:
        for i, width in enumerate(widths):
            row.cells[i].width = Cm(width)
    return t


def plain_table(doc, rows, widths, font_size: float = 9.5):
    t = doc.add_table(rows=0, cols=len(widths))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    table_borders(t)
    cell_margins(t)
    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        cant_split(t.rows[-1])
        for i, value in enumerate(row):
            cell = cells[i]
            cell.text = ""
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(str(value))
            r.font.size = Pt(font_size)
            if i == 0:
                r.bold = True
                r.font.color.rgb = RGBColor.from_string(BLUE)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            if ri % 2 == 1:
                shade(cell, "F7F9FC")
    for row in t.rows:
        for i, width in enumerate(widths):
            row.cells[i].width = Cm(width)
    return t


def stat_strip(doc, items):
    t = doc.add_table(rows=1, cols=len(items))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    table_borders(t, colour="D6E4F3")
    cell_margins(t, top=90, bottom=90, left=100, right=100)
    for i, (big, small) in enumerate(items):
        cell = t.cell(0, i)
        cell.text = ""
        shade(cell, LIGHT_BLUE)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(big)
        r.bold = True
        r.font.size = Pt(18)
        r.font.color.rgb = RGBColor.from_string(BLUE)
        p2 = cell.add_paragraph()
        p2.paragraph_format.space_after = Pt(0)
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r2 = p2.add_run(small)
        r2.font.size = Pt(8)
        r2.font.color.rgb = RGBColor.from_string(GREY)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        cell.width = Cm(4.25)
    return t


def callout(doc, title: str, items):
    t = doc.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    table_borders(t, colour="B7D3EE")
    cell_margins(t, top=90, bottom=90, left=120, right=120)
    cell = t.cell(0, 0)
    cell.width = Cm(17)
    shade(cell, LIGHT_BLUE)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run(title)
    r.bold = True
    r.font.size = Pt(10.5)
    r.font.color.rgb = RGBColor.from_string(BLUE)
    for item in items:
        p = cell.add_paragraph()
        p.paragraph_format.space_after = Pt(1)
        p.paragraph_format.left_indent = Cm(0.35)
        r = p.add_run("•  " + item)
        r.font.size = Pt(9.5)
    return t


def add_field(paragraph, code: str, placeholder: str = "1"):
    run = paragraph.add_run()
    fld1 = OxmlElement("w:fldChar")
    fld1.set(qn("w:fldCharType"), "begin")
    run._r.append(fld1)

    run2 = paragraph.add_run()
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = code
    run2._r.append(instr)

    run3 = paragraph.add_run()
    fld2 = OxmlElement("w:fldChar")
    fld2.set(qn("w:fldCharType"), "separate")
    run3._r.append(fld2)

    paragraph.add_run(placeholder)

    run5 = paragraph.add_run()
    fld3 = OxmlElement("w:fldChar")
    fld3.set(qn("w:fldCharType"), "end")
    run5._r.append(fld3)


def configure(doc):
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.9)
    section.bottom_margin = Cm(1.8)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)
    section.header_distance = Cm(1.0)
    section.footer_distance = Cm(0.9)
    section.different_first_page_header_footer = True

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor(0x1A, 0x1A, 0x1A)
    normal.paragraph_format.space_after = Pt(4)
    normal.paragraph_format.line_spacing = 1.12

    header = section.header.paragraphs[0]
    header.text = ""
    r = header.add_run("IntelliSource to KPRISM — 3-Month Delivery Plan")
    r.font.size = Pt(8)
    r.font.color.rgb = RGBColor.from_string(GREY)
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT

    footer = section.footer.paragraphs[0]
    footer.text = ""
    footer.paragraph_format.tab_stops.add_tab_stop(Cm(17.0), WD_TAB_ALIGNMENT.RIGHT)
    r = footer.add_run("Version 1.1  ·  6 November 2026\t")
    r.font.size = Pt(8)
    r.font.color.rgb = RGBColor.from_string(GREY)
    r2 = footer.add_run("Page ")
    r2.font.size = Pt(8)
    r2.font.color.rgb = RGBColor.from_string(GREY)
    add_field(footer, "PAGE")
    r3 = footer.add_run(" of ")
    r3.font.size = Pt(8)
    r3.font.color.rgb = RGBColor.from_string(GREY)
    add_field(footer, "NUMPAGES")


# ---------------------------------------------------------------------------
# Word document
# ---------------------------------------------------------------------------

def build_word(path: Path):
    doc = Document()
    doc.core_properties.title = "IntelliSource to KPRISM — 3-Month Delivery Plan"
    doc.core_properties.subject = "Vendor Repository, Profit Centre, Contract Register and assistant upgrade"
    doc.core_properties.author = "Project team"
    doc.core_properties.comments = "Version 1.1, 6 November 2026"
    configure(doc)

    # Cover
    band = doc.add_table(rows=1, cols=1)
    band.autofit = False
    no_borders(band)
    cell = band.cell(0, 0)
    cell.width = Cm(17)
    shade(cell, BLUE)
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(7)
    p.paragraph_format.space_after = Pt(7)
    r = p.add_run("KPMG")
    r.bold = True
    r.font.size = Pt(18)
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    for _ in range(6):
        doc.add_paragraph()

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run("IntelliSource to KPRISM")
    r.bold = True
    r.font.size = Pt(30)
    r.font.color.rgb = RGBColor.from_string(BLUE)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(10)
    r = p.add_run("3-Month Delivery Plan")
    r.font.size = Pt(19)
    r.font.color.rgb = RGBColor.from_string(MID_BLUE)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    p_pr = p._p.get_or_add_pPr()
    bdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "12")
    bottom.set(qn("w:space"), "6")
    bottom.set(qn("w:color"), MID_BLUE)
    bdr.append(bottom)
    p_pr.append(bdr)

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(26)
    r = p.add_run("Vendor Repository  ·  Profit Centre  ·  Contract Register  ·  Assistant Upgrade")
    r.font.size = Pt(10.5)
    r.font.color.rgb = RGBColor.from_string(GREY)

    plain_table(
        doc,
        [
            ("Prepared for", "IntelliSource and KPRISM programme"),
            ("Prepared by", "Project team"),
            ("Version", "1.1 — draft for approval"),
            ("Date", "6 November 2026"),
            ("Duration", "13 weeks, 9 November 2026 to 5 February 2027"),
        ],
        widths=[3.6, 13.4],
    )

    for _ in range(6):
        doc.add_paragraph()
    p = doc.add_paragraph()
    r = p.add_run("Internal use only")
    r.font.size = Pt(8)
    r.font.color.rgb = RGBColor.from_string(GREY)

    doc.add_page_break()

    # Purpose
    heading(doc, "Purpose")
    body(
        doc,
        "This plan explains how three useful parts of IntelliSource will be added to KPRISM in three months, "
        "and how the existing KPRISM assistant will be upgraded using the stronger parts of the IntelliSource "
        "assistant. The three modules are the Vendor Repository, Profit Centre and Contract Register.",
    )
    body(
        doc,
        "The work is one add-on module. It uses KPRISM sign-in, follows the KPRISM look and feel, reads client "
        "project data without changing it, and keeps a small separate database for the information it owns — "
        "contacts, notes, budgets and contracts. There is one assistant, not a second one.",
    )
    body(
        doc,
        "Three months is a short window, so this is a first-release plan. It delivers a usable version of each "
        "module and the most valuable assistant improvements. It does not deliver every feature in the original "
        "longer plan.",
    )

    stat_strip(
        doc,
        [
            ("13 weeks", "9 Nov 2026 – 5 Feb 2027"),
            ("4 releases", "One per module + assistant"),
            ("3 modules", "Vendor, Profit Centre, Contract"),
            ("1 assistant", "Upgraded in place"),
        ],
    )

    heading(doc, "The 3-month plan at a glance")
    table(
        doc,
        ["Phase", "Weeks", "Dates", "What we finish with"],
        [
            ("Set-up and secure shell", "1–2", "9–20 Nov 2026", PHASES[0]["outcome"]),
            ("Vendor Repository", "3–5", "23 Nov – 11 Dec 2026", PHASES[1]["outcome"]),
            ("Profit Centre", "5–9", "7 Dec 2026 – 8 Jan 2027", PHASES[2]["outcome"]),
            ("Contract Register", "8–10", "28 Dec 2026 – 15 Jan 2027", PHASES[3]["outcome"]),
            ("Assistant upgrade", "3–11", "23 Nov 2026 – 22 Jan 2027", PHASES[4]["outcome"]),
            ("Hardening and launch", "12–13", "25 Jan – 5 Feb 2027", PHASES[5]["outcome"]),
        ],
        widths=[4.0, 1.8, 4.6, 6.6],
        font_size=8.8,
        first_col_bold=True,
        centre_cols=(1,),
    )
    body(doc, "", space_after=2)
    callout(
        doc,
        "What makes three months possible",
        [
            "Three full-time engineers: backend, frontend and AI.",
            "Thin first versions of each module, not the full long-term feature set.",
            "KPRISM sign-in, project access and data are reused, not rebuilt.",
            "No changes to KPRISM's Java application.",
            "Business users are available for weekly user acceptance testing.",
        ],
    )
    body(
        doc,
        "If any of these is not true, the date moves. The plan is aggressive by design and protects the "
        "release dates by keeping scope thin.",
        size=9,
        colour=GREY,
        space_after=8,
    )

    doc.add_page_break()

    # What happens each month
    heading(doc, "What happens each month")

    subheading(doc, "Month 1 — Build the base and release vendors (November – early December 2026)")
    bullets(
        doc,
        [
            "Week 1: agree scope, access rule and success measures; set up environments and the module skeleton.",
            "Week 2: add KPRISM sign-in, project-only access, the module database and the read-only project connection.",
            "Weeks 3–4: build the vendor list, search, detail, contacts and notes.",
            "Week 5: vendor quality checks, user acceptance and Release 1.",
            "Assistant work starts in week 3: agree 8–10 questions and connect KPRISM's approved AI service.",
        ],
        size=9.5,
    )

    subheading(doc, "Month 2 — Profit Centre and the start of contracts (December 2026 – early January 2027)")
    bullets(
        doc,
        [
            "Profit centre design starts in week 5; build runs weeks 6–7 for master data, budget entry and budget versus actual.",
            "Week 8: profit centre user acceptance; contract register design starts.",
            "Week 9: Release 2 (Profit Centre); contract list and detail build starts.",
            "Assistant: Excel, PDF and PowerPoint exports and chart follow-up are delivered.",
            "Weeks 7–8 include the year-end holidays. They are low-capacity weeks and hold no releases.",
        ],
        size=9.5,
    )

    subheading(doc, "Month 3 — Contract, assistant and go-live (January – February 2027)")
    bullets(
        doc,
        [
            "Weeks 10–11: contract status, expiry view and Release 3; assistant multi-step answers, module tools, user testing and Release 4.",
            "Week 12: security and performance checks; user guide and training.",
            "Week 13: go-live, first-week support and project close.",
        ],
        size=9.5,
    )

    heading(doc, "Releases and dates")
    table(
        doc,
        ["Release", "Date", "What is included", "Acceptance"],
        [
            ("R1 — Vendor Repository", dt(week_end(5), True), RELEASES[0][3], RELEASES[0][4]),
            ("R2 — Profit Centre", dt(week_end(9), True), RELEASES[1][3], RELEASES[1][4]),
            ("R3 — Contract Register", dt(week_end(10), True), RELEASES[2][3], RELEASES[2][4]),
            ("R4 — Upgraded assistant", dt(week_end(11), True), RELEASES[3][3], RELEASES[3][4]),
            ("Go-live and close", dt(END, True), "All four releases live and supported.", "No high security findings; training done."),
        ],
        widths=[3.8, 3.0, 6.8, 3.4],
        font_size=8.8,
        first_col_bold=True,
        centre_cols=(1,),
    )

    # Team
    heading(doc, "Team and effort")
    body(
        doc,
        "The plan needs about three full-time engineers and part-time support from the project lead, business "
        "analyst, data engineer, QA, security and DevOps. The estimate is around 65–70 person-weeks over 13 weeks.",
    )
    table(
        doc,
        ["Role", "Time", "Main job"],
        TEAM,
        widths=[4.0, 3.4, 9.6],
        font_size=8.8,
        first_col_bold=True,
        centre_cols=(1,),
    )

    heading(doc, "What could change the date")
    table(
        doc,
        ["Risk", "Control"],
        RISKS,
        widths=[5.4, 11.6],
        font_size=9,
        first_col_bold=True,
    )

    heading(doc, "What is not included")
    bullets(doc, SCOPE_OUT, size=9.5)

    heading(doc, "How we will know it worked")
    table(
        doc,
        ["Measure", "Target"],
        SUCCESS,
        widths=[4.4, 12.6],
        font_size=9,
        first_col_bold=True,
    )

    heading(doc, "Next steps")
    table(
        doc,
        ["When", "Action", "Owner"],
        [
            ("Week 1", "Approve this plan and name the business owner.", "Project lead"),
            ("Week 1", "Confirm the project access rule and book environments.", "Business analyst + DevOps"),
            ("Week 2", "Show the secure shell and sign-in gate to the business.", "Project team"),
            ("Weekly", "30-minute delivery meeting; fortnightly demo; monthly steering.", "Project lead"),
        ],
        widths=[2.2, 10.8, 4.0],
        font_size=9,
        first_col_bold=True,
        centre_cols=(0,),
    )

    doc.save(path)


# ---------------------------------------------------------------------------
# Excel helpers
# ---------------------------------------------------------------------------

def xl_fill(colour: str) -> PatternFill:
    return PatternFill("solid", start_color=colour, end_color=colour)


def xl_font(size: int = 10, bold: bool = False, colour: str = "1A1A1A") -> Font:
    return Font(name="Calibri", size=size, bold=bold, color=colour)


def xl_border(colour: str = "D0D7E5") -> Border:
    side = Side(style="thin", color=colour)
    return Border(left=side, right=side, top=side, bottom=side)


def xl_page(ws, fit_width: int = 1, fit_height: int = 1):
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = fit_width
    ws.page_setup.fitToHeight = fit_height
    ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
    ws.page_margins.left = 0.3
    ws.page_margins.right = 0.3
    ws.page_margins.top = 0.4
    ws.page_margins.bottom = 0.4


def build_excel(path: Path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Timeline"
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = BLUE

    # Columns
    ws.column_dimensions["A"].width = 6
    ws.column_dimensions["B"].width = 46
    ws.column_dimensions["C"].width = 22
    ws.column_dimensions["D"].width = 9
    ws.column_dimensions["E"].width = 9
    ws.column_dimensions["F"].width = 12
    for w in range(1, WEEKS + 1):
        ws.column_dimensions[get_column_letter(6 + w)].width = 3.6

    # Title
    ws.merge_cells("A1:S1")
    c = ws["A1"]
    c.value = "IntelliSource to KPRISM — 3-Month Timeline"
    c.font = xl_font(18, True, BLUE)
    c.alignment = Alignment(vertical="center")
    ws.row_dimensions[1].height = 30

    ws.merge_cells("A2:S2")
    c = ws["A2"]
    c.value = "9 November 2026 to 5 February 2027  ·  13 weeks  ·  first release"
    c.font = xl_font(9, False, GREY)
    c.alignment = Alignment(vertical="center")

    ws.merge_cells("A3:S3")
    c = ws["A3"]
    c.value = ("Bars show planned work. ◆ marks a release or milestone. "
               "Update the Status column as work progresses. "
               "Weeks 7–8 include the year-end holidays and hold no releases.")
    c.font = xl_font(8, False, GREY)
    c.alignment = Alignment(vertical="center", wrap_text=True)
    ws.row_dimensions[3].height = 26

    # Month band
    month_band = [(1, 4, "MONTH 1"), (5, 8, "MONTH 2"), (9, 13, "MONTH 3")]
    for start_w, end_w, label in month_band:
        c1 = 6 + start_w
        c2 = 6 + end_w
        ws.merge_cells(start_row=4, start_column=c1, end_row=4, end_column=c2)
        cell = ws.cell(row=4, column=c1, value=label)
        cell.font = xl_font(8, True, BLUE)
        cell.fill = xl_fill("D6E4F3")
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = xl_border()
        for col in range(c1, c2 + 1):
            ws.cell(row=4, column=col).border = xl_border()
            ws.cell(row=4, column=col).fill = xl_fill("D6E4F3")
    ws.row_dimensions[4].height = 20

    # Header row
    headers = ["ID", "Workstream / task", "Owner", "Start", "End", "Status"] + [f"W{w}" for w in range(1, WEEKS + 1)]
    for i, text in enumerate(headers, start=1):
        c = ws.cell(row=5, column=i, value=text)
        c.font = xl_font(8, True, WHITE)
        c.fill = xl_fill(BLUE)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = xl_border()
    ws.row_dimensions[5].height = 24

    # Rows
    row = 6
    section_rows = {}
    for phase in PHASES:
        section_rows[phase["name"]] = row
        # Section header: merged A:F, phase colour across its weeks
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
        c = ws.cell(row=row, column=1, value=phase["name"].upper())
        c.font = xl_font(8.5, True, BLUE)
        c.fill = xl_fill("D6E4F3")
        c.alignment = Alignment(vertical="center")
        for col in range(1, 7):
            ws.cell(row=row, column=col).border = xl_border()
            ws.cell(row=row, column=col).fill = xl_fill("D6E4F3")
        for w in range(1, WEEKS + 1):
            cell = ws.cell(row=row, column=6 + w)
            cell.border = xl_border("FFFFFF")
            if phase["start"] <= w <= phase["end"]:
                cell.fill = xl_fill(phase["colour"])
        ws.row_dimensions[row].height = 20
        row += 1

        phase_tasks = [t for t in TASKS if t[1] == phase["name"]]
        for task in phase_tasks:
            tid, _, name, owner, start_w, end_w, milestone = task
            values = [tid, name, owner, week_start(start_w), week_end(end_w), "Not started"]
            for i, value in enumerate(values, start=1):
                c = ws.cell(row=row, column=i, value=value)
                c.font = xl_font(8.5, milestone)
                c.alignment = Alignment(
                    horizontal="center" if i in (1, 4, 5, 6) else "left",
                    vertical="center",
                    wrap_text=True,
                )
                c.border = xl_border()
                if milestone:
                    c.fill = xl_fill("FFF4D6")
            ws.cell(row=row, column=4).number_format = "dd mmm"
            ws.cell(row=row, column=5).number_format = "dd mmm"
            for w in range(1, WEEKS + 1):
                cell = ws.cell(row=row, column=6 + w)
                cell.border = xl_border("FFFFFF")
                if milestone and w == start_w:
                    cell.value = "◆"
                    cell.font = xl_font(8, True, WHITE)
                    cell.fill = xl_fill(GOLD)
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                elif start_w <= w <= end_w:
                    cell.fill = xl_fill(phase["colour"])
            ws.row_dimensions[row].height = 22
            row += 1

    last_task_row = row - 1

    # Status validation and colours
    dv = DataValidation(type="list", formula1='"Not started,In progress,Done,Blocked"', allow_blank=False)
    ws.add_data_validation(dv)
    dv.add(f"F6:F{last_task_row}")
    ws.conditional_formatting.add(f"F6:F{last_task_row}", CellIsRule(operator="equal", formula=['"Done"'], fill=xl_fill("C6EFCE")))
    ws.conditional_formatting.add(f"F6:F{last_task_row}", CellIsRule(operator="equal", formula=['"In progress"'], fill=xl_fill("DDEBF7")))
    ws.conditional_formatting.add(f"F6:F{last_task_row}", CellIsRule(operator="equal", formula=['"Blocked"'], fill=xl_fill("FFC7CE")))

    # Key dates
    row += 1
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
    c = ws.cell(row=row, column=1, value="Key dates")
    c.font = xl_font(12, True, BLUE)
    row += 1
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
    c = ws.cell(row=row, column=1, value="Release")
    c.font = xl_font(8.5, True, WHITE)
    c.fill = xl_fill(BLUE)
    c.alignment = Alignment(horizontal="center", vertical="center")
    c.border = xl_border()
    ws.cell(row=row, column=2).fill = xl_fill(BLUE)
    ws.cell(row=row, column=2).border = xl_border()
    c = ws.cell(row=row, column=3, value="Date")
    c.font = xl_font(8.5, True, WHITE)
    c.fill = xl_fill(BLUE)
    c.alignment = Alignment(horizontal="center", vertical="center")
    c.border = xl_border()
    ws.merge_cells(start_row=row, start_column=4, end_row=row, end_column=6)
    c = ws.cell(row=row, column=4, value="What is included")
    c.font = xl_font(8.5, True, WHITE)
    c.fill = xl_fill(BLUE)
    c.alignment = Alignment(horizontal="center", vertical="center")
    c.border = xl_border()
    for col in range(4, 7):
        ws.cell(row=row, column=col).fill = xl_fill(BLUE)
        ws.cell(row=row, column=col).border = xl_border()
    ws.row_dimensions[row].height = 20

    for i, rls in enumerate(RELEASES):
        row += 1
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
        c = ws.cell(row=row, column=1, value=f"{rls[0]} — {rls[1]}")
        c.font = xl_font(8.5, True)
        c.border = xl_border()
        ws.cell(row=row, column=2).border = xl_border()
        c2 = ws.cell(row=row, column=3, value=week_end(rls[2]))
        c2.font = xl_font(8.5)
        c2.number_format = "dd mmm yyyy"
        c2.alignment = Alignment(horizontal="center", vertical="center")
        c2.border = xl_border()
        ws.merge_cells(start_row=row, start_column=4, end_row=row, end_column=6)
        c3 = ws.cell(row=row, column=4, value=rls[3])
        c3.font = xl_font(8.5)
        c3.alignment = Alignment(vertical="center", wrap_text=True)
        for col in range(4, 7):
            ws.cell(row=row, column=col).border = xl_border()
        ws.row_dimensions[row].height = 24

    row += 1
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
    c = ws.cell(row=row, column=1, value="Go-live and close")
    c.font = xl_font(8.5, True)
    c.border = xl_border()
    ws.cell(row=row, column=2).border = xl_border()
    c2 = ws.cell(row=row, column=3, value=END)
    c2.font = xl_font(8.5)
    c2.number_format = "dd mmm yyyy"
    c2.alignment = Alignment(horizontal="center", vertical="center")
    c2.border = xl_border()
    ws.merge_cells(start_row=row, start_column=4, end_row=row, end_column=6)
    c3 = ws.cell(row=row, column=4, value="All four releases live and supported.")
    c3.font = xl_font(8.5)
    c3.alignment = Alignment(vertical="center", wrap_text=True)
    for col in range(4, 7):
        ws.cell(row=row, column=col).border = xl_border()

    # Notes
    row += 2
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=19)
    c = ws.cell(row=row, column=1, value="Notes")
    c.font = xl_font(10, True, BLUE)
    notes = [
        "Assumes three full-time engineers, thin first-release scope, and business users available for weekly UAT.",
        "Weeks 7–8 include the year-end holidays. No releases are planned in those weeks.",
        "If the team is smaller, or project data is missing, the date moves. See the Word plan.",
    ]
    for note in notes:
        row += 1
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=19)
        c = ws.cell(row=row, column=1, value="•  " + note)
        c.font = xl_font(8, False, GREY)
        c.alignment = Alignment(vertical="center", wrap_text=True)

    # Legend
    row += 2
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
    c = ws.cell(row=row, column=1, value="Legend")
    c.font = xl_font(9, True, BLUE)
    legend_start = row + 1
    for i, phase in enumerate(PHASES):
        r = legend_start + i
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
        c = ws.cell(row=r, column=1, value=phase["name"])
        c.fill = xl_fill(phase["colour"])
        c.font = xl_font(8, True, WHITE)
        c.border = xl_border()
        ws.cell(row=r, column=2).fill = xl_fill(phase["colour"])
        ws.cell(row=r, column=2).border = xl_border()
    r = legend_start + len(PHASES)
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
    c = ws.cell(row=r, column=1, value="Release / milestone")
    c.fill = xl_fill(GOLD)
    c.font = xl_font(8, True, WHITE)
    c.border = xl_border()
    ws.cell(row=r, column=2).fill = xl_fill(GOLD)
    ws.cell(row=r, column=2).border = xl_border()

    ws.freeze_panes = "G6"
    ws.print_title_rows = "5:5"
    xl_page(ws, 1, 0)
    wb.save(path)


def main():
    out_dir = Path(__file__).resolve().parent.parent / "docs" / "planning" / "intellisource-kprism-integration"
    out_dir.mkdir(parents=True, exist_ok=True)
    docx_path = out_dir / "Project_Plan_IntelliSource_to_KPRISM.docx"
    xlsx_path = out_dir / "Project_Plan_IntelliSource_to_KPRISM.xlsx"
    try:
        build_word(docx_path)
        print(f"Word:  {docx_path}")
    except PermissionError:
        alt = out_dir / "Project_Plan_IntelliSource_to_KPRISM_new.docx"
        build_word(alt)
        print(f"Word (target is open, saved as): {alt}")
    build_excel(xlsx_path)
    print(f"Excel: {xlsx_path}")


if __name__ == "__main__":
    main()
