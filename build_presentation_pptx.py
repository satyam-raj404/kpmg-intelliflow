"""Build IntelliSource_Presentation.pptx — comprehensive KPMG demo deck with real screenshots."""

import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# ── KPMG Brand Palette ─────────────────────────────────────────────────────────
KPMG_NAVY   = RGBColor(0x00, 0x33, 0x8D)
KPMG_MED    = RGBColor(0x00, 0x5E, 0xB8)
KPMG_LIGHT  = RGBColor(0x00, 0x91, 0xDA)
KPMG_TEAL   = RGBColor(0x00, 0x99, 0xA8)
KPMG_GOLD   = RGBColor(0x8F, 0x73, 0x26)
KPMG_RED    = RGBColor(0xBC, 0x20, 0x4B)
KPMG_GRAY   = RGBColor(0x63, 0x66, 0x6A)
KPMG_LTGRAY = RGBColor(0xF2, 0xF2, 0xF2)
WHITE       = RGBColor(0xFF, 0xFF, 0xFF)
BLACK       = RGBColor(0x1A, 0x1A, 0x1A)
GREEN_OK    = RGBColor(0x00, 0x7A, 0x33)
ORANGE_WARN = RGBColor(0xFF, 0x6B, 0x00)

SLIDE_W = Inches(13.33)
SLIDE_H = Inches(7.5)

SCREENSHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app_screenshots")

def ss(name):
    """Return full path for a screenshot file. Filenames use narrow no-break space   before AM/PM."""
    fname = f"Screenshot 2026-07-08 at {name}.png".replace(" PM", " PM").replace(" AM", " AM")
    return os.path.join(SCREENSHOTS, fname)


prs = Presentation()
prs.slide_width  = SLIDE_W
prs.slide_height = SLIDE_H
BLANK = prs.slide_layouts[6]


# ── helpers ────────────────────────────────────────────────────────────────────

def add_rect(slide, x, y, w, h, fill_rgb):
    shape = slide.shapes.add_shape(1, x, y, w, h)
    shape.line.fill.background()
    if fill_rgb is None:
        shape.fill.background()
    else:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill_rgb
    return shape


def add_text(slide, text, x, y, w, h,
             size=12, bold=False, color=WHITE,
             align=PP_ALIGN.LEFT, wrap=True, italic=False):
    txBox = slide.shapes.add_textbox(x, y, w, h)
    tf = txBox.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    run.font.name = "Calibri"
    return txBox


def add_image(slide, path, x, y, w, h):
    if os.path.exists(path):
        slide.shapes.add_picture(path, x, y, w, h)
    else:
        add_rect(slide, x, y, w, h, KPMG_LTGRAY)
        add_text(slide, f"[Image not found]\n{os.path.basename(path)}",
                 x + Inches(0.1), y + Inches(0.1), w - Inches(0.2), h - Inches(0.2),
                 size=8, color=KPMG_GRAY, italic=True)


def kpmg_header(slide, title, subtitle=None, accent=KPMG_LIGHT):
    add_rect(slide, 0, 0, SLIDE_W, Inches(1.15), KPMG_NAVY)
    add_rect(slide, 0, 0, Inches(0.1), Inches(1.15), accent)
    add_text(slide, title,
             Inches(0.25), Inches(0.1), Inches(10.5), Inches(0.65),
             size=28, bold=True, color=WHITE)
    if subtitle:
        add_text(slide, subtitle,
                 Inches(0.25), Inches(0.72), Inches(10.5), Inches(0.38),
                 size=13, color=KPMG_LIGHT)


def kpmg_footer(slide):
    add_rect(slide, 0, Inches(7.1), SLIDE_W, Inches(0.4), KPMG_NAVY)
    add_text(slide, "KPMG India  |  IntelliSource — P2P Intelligence & Analytics Platform  |  Q2 FY2024",
             Inches(0.2), Inches(7.13), Inches(10.5), Inches(0.28),
             size=8, color=RGBColor(0xB0, 0xC4, 0xDE))
    add_text(slide, "CONFIDENTIAL",
             Inches(11.5), Inches(7.13), Inches(1.7), Inches(0.28),
             size=8, bold=True, color=KPMG_GOLD, align=PP_ALIGN.RIGHT)


def divider(slide, y, color=KPMG_LIGHT):
    add_rect(slide, Inches(0.2), y, Inches(12.9), Inches(0.03), color)


def kpi_card(slide, label, value, note, x, y, w=Inches(2.8), h=Inches(1.3),
             val_color=KPMG_NAVY, note_color=KPMG_GRAY, bg=KPMG_LTGRAY, accent=KPMG_NAVY):
    add_rect(slide, x, y, w, h, bg)
    add_rect(slide, x, y, w, Inches(0.05), accent)
    add_text(slide, label, x + Inches(0.1), y + Inches(0.1), w - Inches(0.2), Inches(0.28),
             size=8.5, color=KPMG_GRAY, bold=False)
    add_text(slide, value, x + Inches(0.1), y + Inches(0.38), w - Inches(0.2), Inches(0.52),
             size=18, bold=True, color=val_color, wrap=False)
    add_text(slide, note, x + Inches(0.1), y + Inches(0.92), w - Inches(0.2), Inches(0.32),
             size=8, color=note_color, italic=True, wrap=True)


def section_header(slide, text, y, color=KPMG_NAVY):
    add_rect(slide, Inches(0.2), y, Inches(12.9), Inches(0.38), color)
    add_text(slide, text, Inches(0.35), y + Inches(0.05), Inches(12.5), Inches(0.3),
             size=12, bold=True, color=WHITE)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 1 — TITLE
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, KPMG_NAVY)
# Accent stripe left
add_rect(s, 0, 0, Inches(0.14), SLIDE_H, KPMG_LIGHT)
# Geometric accent top-right
add_rect(s, Inches(10.0), 0, Inches(3.33), Inches(3.5), KPMG_MED)
add_rect(s, Inches(11.2), 0, Inches(2.13), Inches(2.0), KPMG_LIGHT)
# KPMG mark
add_text(s, "KPMG", Inches(0.35), Inches(0.35), Inches(4), Inches(0.9),
         size=42, bold=True, color=WHITE)
add_text(s, "India  |  Procurement Advisory",
         Inches(0.35), Inches(1.2), Inches(5), Inches(0.4),
         size=14, color=KPMG_LIGHT)
divider(s, Inches(1.75), KPMG_GOLD)
# Product name
add_text(s, "IntelliSource",
         Inches(0.35), Inches(1.95), Inches(11.5), Inches(1.5),
         size=62, bold=True, color=WHITE)
add_text(s, "SAP Procurement Intelligence & Analytics Platform",
         Inches(0.35), Inches(3.4), Inches(11), Inches(0.65),
         size=24, color=KPMG_LIGHT)
divider(s, Inches(4.2), KPMG_LIGHT)
add_text(s,
    "5 Dashboards  ·  187 SOD Conflicts Detected  ·  ₹3,936 Cr Spend Visibility  ·  Live from SAP Data",
    Inches(0.35), Inches(4.38), Inches(12.5), Inches(0.45),
    size=13, color=RGBColor(0xB0, 0xC4, 0xDE))
add_text(s, "Application Demo  |  Q2 FY2024  |  All Companies",
         Inches(0.35), Inches(4.9), Inches(8), Inches(0.38),
         size=11, color=KPMG_GRAY)
# Bottom bar
add_rect(s, 0, Inches(6.9), SLIDE_W, Inches(0.6), KPMG_MED)
add_text(s, "KPMG India  |  Advisory  |  Procurement Excellence",
         Inches(0.3), Inches(6.97), Inches(10), Inches(0.4),
         size=11, color=WHITE)
add_text(s, "CONFIDENTIAL",
         Inches(11.6), Inches(6.97), Inches(1.6), Inches(0.4),
         size=11, bold=True, color=KPMG_GOLD, align=PP_ALIGN.RIGHT)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 2 — EXECUTIVE SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
kpmg_header(s, "Executive Summary", "IntelliSource — Key Numbers at a Glance")
kpmg_footer(s)

# Top KPI band
add_rect(s, 0, Inches(1.18), SLIDE_W, Inches(1.55), KPMG_LTGRAY)
top_kpis = [
    ("Total Spend Visibility", "₹3,936 Cr", "All companies · All departments"),
    ("SOD Conflicts Detected", "187", "Across 4 P2P control points"),
    ("P2P End-to-End Cycle", "44.5 days", "PR → PO → GRN → Invoice → Payment"),
    ("Maverick Spend Rate", "19.0%", "POs without approved requisition"),
    ("3-Way Match Rate", "84.0%", "PO–GRN–Invoice alignment"),
    ("Vendor Compliance", "84.6%", "Not blocked · not deleted"),
]
cx = Inches(0.15)
for label, val, note in top_kpis:
    cw = Inches(2.18)
    kpi_card(s, label, val, note, cx, Inches(1.25), w=cw, h=Inches(1.4),
             val_color=KPMG_NAVY, bg=WHITE, accent=KPMG_MED)
    cx += cw + Inches(0.02)

# Platform description
add_text(s, "What IntelliSource Delivers",
         Inches(0.2), Inches(2.82), Inches(12), Inches(0.38),
         size=15, bold=True, color=KPMG_NAVY)
divider(s, Inches(3.2), KPMG_LIGHT)

desc_items = [
    ("5 Role-Specific Dashboards", "Procurement · Financial · Leadership · Vendor Performance · Utilization — each calibrated to the decisions that matter most to that audience."),
    ("Live from SAP Exports", "Upload CSV files from ME2M, MB51, FBL1N, F110, XK03 — IntelliSource ETL validates, deduplicates, and recomputes all KPIs across all dashboards in under 90 seconds."),
    ("SOD Conflict Engine", "Automatically cross-references creator IDs across PO, GRN, Invoice, and Payment to surface Segregation of Duty violations that SAP's authorisation matrix alone cannot detect."),
    ("P2P Lifecycle Tracker", "End-to-end funnel: 132 PRs → 163 POs → 117 GRNs → 106 Invoices → 82 Payments — with stage health, bottleneck detection, and process variant distribution."),
    ("Ask IntelliSource (AI)", "Natural language query interface over all uploaded data — no SQL, no analyst required for ad-hoc questions."),
]
iy = Inches(3.3)
for title, body in desc_items:
    add_rect(s, Inches(0.2), iy, Inches(0.06), Inches(0.55), KPMG_MED)
    add_text(s, title, Inches(0.38), iy + Inches(0.02), Inches(3.0), Inches(0.25),
             size=10, bold=True, color=KPMG_NAVY)
    add_text(s, body, Inches(0.38), iy + Inches(0.26), Inches(12.5), Inches(0.32),
             size=9.5, color=KPMG_GRAY, wrap=True)
    iy += Inches(0.65)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 3 — APPLICATION OVERVIEW (NAVIGATION MAP)
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
kpmg_header(s, "Application Overview", "Full Module Map — Dashboards, Operations & Admin")
kpmg_footer(s)

# Module groups
groups = [
    ("DASHBOARDS", KPMG_NAVY, [
        ("Procurement", "PO lifecycle · Maverick spend · Cycle time · Deletion alerts"),
        ("Financial", "Payments · 3-Way match · Duplicate invoices · AP aging"),
        ("Leadership", "SOD conflicts · High-value POs · Spend risk panel · CAPEX/OPEX"),
        ("Vendor Performance", "Compliance · Lead time · Top vendors · MSME tracking"),
        ("Utilization", "CAPEX/OPEX split · Monthly trend · Department breakdown"),
        ("Profit Centers", "39 active profit centres · Budget vs actual · Plant-wise drill"),
    ]),
    ("OPERATIONS", KPMG_TEAL, [
        ("Ask IntelliSource", "AI natural language query on all uploaded SAP data"),
        ("P2P Lifecycle Tracker", "7-stage funnel · Stage health · Process variant analysis"),
        ("Vendor Repository", "13 vendors · Searchable catalog · Category filter"),
        ("Log Action", "Manual procurement action logging with audit trail"),
        ("Data Upload", "CSV/Excel from SAP · Auto-detected dataset type · Max 50 MB"),
        ("Activity History", "Complete record of all uploads and report downloads"),
    ]),
    ("ADMIN", KPMG_GOLD, [
        ("User Management", "Role-based access · Procurement Manager · Admin roles"),
        ("Audit Trail", "System-level event log for compliance"),
        ("Settings", "Period configuration · Company code · Alert thresholds"),
    ]),
]

gx = Inches(0.2)
for grp_name, grp_color, modules in groups:
    gw = Inches(4.3) if grp_name != "ADMIN" else Inches(4.3)
    add_rect(s, gx, Inches(1.25), gw, Inches(0.38), grp_color)
    add_text(s, grp_name, gx + Inches(0.12), Inches(1.3), gw - Inches(0.2), Inches(0.3),
             size=11, bold=True, color=WHITE)
    my = Inches(1.65)
    for mod_name, mod_desc in modules:
        add_rect(s, gx, my, gw, Inches(0.8), KPMG_LTGRAY)
        add_rect(s, gx, my, Inches(0.05), Inches(0.8), grp_color)
        add_text(s, mod_name, gx + Inches(0.12), my + Inches(0.07), gw - Inches(0.2), Inches(0.28),
                 size=10, bold=True, color=KPMG_NAVY)
        add_text(s, mod_desc, gx + Inches(0.12), my + Inches(0.35), gw - Inches(0.2), Inches(0.4),
                 size=8.5, color=KPMG_GRAY, wrap=True)
        my += Inches(0.85)
    gx += gw + Inches(0.17)

# Alert Center note
add_rect(s, Inches(0.2), Inches(6.55), Inches(12.9), Inches(0.48), KPMG_RED)
add_text(s,
    "ALERT CENTER  —  Live alert banner across all pages: 4 Critical + 3 Warning alerts "
    "including duplicate invoices, blocked vendors, payment-before-GRN, and high-risk SOD violations",
    Inches(0.35), Inches(6.6), Inches(12.5), Inches(0.38),
    size=9.5, bold=False, color=WHITE, wrap=True)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 4 — PROCUREMENT DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
kpmg_header(s, "Procurement Dashboard", "PO Lifecycle · Maverick Spend · Cycle Time · Contract Compliance",
            accent=KPMG_NAVY)
kpmg_footer(s)

# Screenshot left
add_image(s, ss("2.20.51 PM"), Inches(0.2), Inches(1.22), Inches(7.8), Inches(5.6))

# KPI panel right
rx = Inches(8.2)
rw = Inches(4.95)
add_rect(s, rx, Inches(1.22), rw, Inches(5.6), KPMG_LTGRAY)

section_header(s, "KEY PERFORMANCE INDICATORS", Inches(1.25))

kpis_proc = [
    ("Total PO Value", "₹71.13 Cr", "Net committed purchase order value", KPMG_NAVY),
    ("Active POs", "74", "Not deleted · open in system", KPMG_MED),
    ("High-Value POs", "85", "POs above ₹1 Cr threshold · review required", KPMG_RED),
    ("PO Cycle Time", "2.7 days", "PR creation → PO document date", GREEN_OK),
]
ky = Inches(1.7)
for label, val, note, color in kpis_proc:
    add_rect(s, rx + Inches(0.1), ky, rw - Inches(0.2), Inches(1.1), WHITE)
    add_rect(s, rx + Inches(0.1), ky, Inches(0.06), Inches(1.1), color)
    add_text(s, label, rx + Inches(0.25), ky + Inches(0.08), rw - Inches(0.5), Inches(0.28),
             size=8.5, color=KPMG_GRAY)
    add_text(s, val, rx + Inches(0.25), ky + Inches(0.35), rw - Inches(0.5), Inches(0.45),
             size=22, bold=True, color=color)
    add_text(s, note, rx + Inches(0.25), ky + Inches(0.8), rw - Inches(0.5), Inches(0.25),
             size=8, color=KPMG_GRAY, italic=True)
    ky += Inches(1.2)

divider(s, ky + Inches(0.05), KPMG_LIGHT)
add_text(s, "DASHBOARD INTELLIGENCE", rx + Inches(0.1), ky + Inches(0.15), rw - Inches(0.2), Inches(0.28),
         size=9, bold=True, color=KPMG_NAVY)
bullets = [
    "PO Monthly Trend chart — ₹ Cr committed per month",
    "Category Breakdown — CAPEX vs OPEX PO split",
    "Vendor-wise spend concentration analysis",
    "Alert: POs with deletion indicator flagged immediately",
]
by = ky + Inches(0.48)
for b in bullets:
    add_text(s, f"▸  {b}", rx + Inches(0.12), by, rw - Inches(0.25), Inches(0.28),
             size=8.5, color=KPMG_NAVY, wrap=True)
    by += Inches(0.33)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 5 — FINANCIAL DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
kpmg_header(s, "Financial Dashboard", "Payments · Invoice Matching · Duplicate Detection · AP Aging",
            accent=KPMG_MED)
kpmg_footer(s)

add_image(s, ss("2.21.22 PM"), Inches(0.2), Inches(1.22), Inches(7.8), Inches(2.7))
add_image(s, ss("2.21.34 PM"), Inches(0.2), Inches(4.0), Inches(7.8), Inches(2.82))

rx = Inches(8.2)
rw = Inches(4.95)
add_rect(s, rx, Inches(1.22), rw, Inches(5.6), KPMG_LTGRAY)
section_header(s, "KEY PERFORMANCE INDICATORS", Inches(1.25))

kpis_fin = [
    ("Total Payments YTD", "₹958.06 Cr", "Outgoing payments this fiscal year", KPMG_MED),
    ("3-Way Match Rate", "84.0%", "PO–GRN–Invoice aligned · target ≥90%", ORANGE_WARN),
    ("Avg Invoice Days", "40.5 days", "Invoice posting → payment cleared", KPMG_NAVY),
    ("Duplicate Invoices", "See drill-down", "Same vendor + amount + date detected", KPMG_RED),
]
ky = Inches(1.7)
for label, val, note, color in kpis_fin:
    add_rect(s, rx + Inches(0.1), ky, rw - Inches(0.2), Inches(1.1), WHITE)
    add_rect(s, rx + Inches(0.1), ky, Inches(0.06), Inches(1.1), color)
    add_text(s, label, rx + Inches(0.25), ky + Inches(0.08), rw - Inches(0.5), Inches(0.28),
             size=8.5, color=KPMG_GRAY)
    add_text(s, val, rx + Inches(0.25), ky + Inches(0.35), rw - Inches(0.5), Inches(0.45),
             size=18, bold=True, color=color)
    add_text(s, note, rx + Inches(0.25), ky + Inches(0.8), rw - Inches(0.5), Inches(0.25),
             size=8, color=KPMG_GRAY, italic=True)
    ky += Inches(1.2)

divider(s, ky + Inches(0.05), KPMG_LIGHT)
add_text(s, "CHARTS & ANALYSIS", rx + Inches(0.1), ky + Inches(0.15), rw - Inches(0.2), Inches(0.28),
         size=9, bold=True, color=KPMG_NAVY)
fin_bullets = [
    "Monthly Payments Trend — ₹ Cr cleared per month",
    "Payment Timing Distribution — before/after due date",
    "Invoice Aging breakdown — overdue AP segmentation",
    "CAPEX vs OPEX payment classification",
]
by = ky + Inches(0.48)
for b in fin_bullets:
    add_text(s, f"▸  {b}", rx + Inches(0.12), by, rw - Inches(0.25), Inches(0.28),
             size=8.5, color=KPMG_NAVY, wrap=True)
    by += Inches(0.33)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 6 — LEADERSHIP DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
kpmg_header(s, "Leadership Dashboard", "Board-Level View · SOD Conflicts · Risk Analytics · Strategic Spend",
            accent=KPMG_RED)
kpmg_footer(s)

add_image(s, ss("2.21.57 PM"), Inches(0.2), Inches(1.22), Inches(7.8), Inches(2.75))
add_image(s, ss("2.22.42 PM"), Inches(0.2), Inches(4.05), Inches(7.8), Inches(2.77))

rx = Inches(8.2)
rw = Inches(4.95)
add_rect(s, rx, Inches(1.22), rw, Inches(5.6), KPMG_LTGRAY)
section_header(s, "STRATEGIC KPIs", Inches(1.25))

kpis_lead = [
    ("Total Committed Spend", "₹3,936.34 Cr", "All companies · all departments · this period", KPMG_NAVY),
    ("SOD Conflicts", "187", "4 control points: PO-Release · PO-GRN · GRN-Inv · Inv-Pay", KPMG_RED),
    ("Maverick Spend Rate", "19.0%", "POs without approved purchase requisition", ORANGE_WARN),
    ("End-to-End Cycle", "44.5 days", "Full P2P: PR creation → payment cleared", KPMG_MED),
]
ky = Inches(1.7)
for label, val, note, color in kpis_lead:
    add_rect(s, rx + Inches(0.1), ky, rw - Inches(0.2), Inches(1.1), WHITE)
    add_rect(s, rx + Inches(0.1), ky, Inches(0.06), Inches(1.1), color)
    add_text(s, label, rx + Inches(0.25), ky + Inches(0.08), rw - Inches(0.5), Inches(0.28),
             size=8.5, color=KPMG_GRAY)
    add_text(s, val, rx + Inches(0.25), ky + Inches(0.35), rw - Inches(0.5), Inches(0.42),
             size=16, bold=True, color=color)
    add_text(s, note, rx + Inches(0.25), ky + Inches(0.78), rw - Inches(0.5), Inches(0.28),
             size=7.5, color=KPMG_GRAY, italic=True, wrap=True)
    ky += Inches(1.2)

divider(s, ky + Inches(0.05), KPMG_LIGHT)
add_text(s, "RISK PANEL HIGHLIGHTS", rx + Inches(0.1), ky + Inches(0.15), rw - Inches(0.2), Inches(0.28),
         size=9, bold=True, color=KPMG_NAVY)
lead_bullets = [
    "CAPEX: 48.3% · OPEX: 51.7% of ₹3,936 Cr total",
    "Monthly Spend Trend — peak/trough analysis",
    "High-Value Threshold: ₹1 Cr — 85 POs flagged",
    "SOD popup: document, SOD type, vendor, user, date",
]
by = ky + Inches(0.48)
for b in lead_bullets:
    add_text(s, f"▸  {b}", rx + Inches(0.12), by, rw - Inches(0.25), Inches(0.28),
             size=8.5, color=KPMG_NAVY, wrap=True)
    by += Inches(0.33)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 7 — SOD CONFLICTS DEEP DIVE
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, KPMG_NAVY)
add_rect(s, 0, 0, Inches(0.12), SLIDE_H, KPMG_RED)
kpmg_footer(s)

add_text(s, "SOD Conflict Detection", Inches(0.3), Inches(0.2), Inches(11), Inches(0.75),
         size=34, bold=True, color=WHITE)
add_text(s, "Segregation of Duty violations invisible in SAP — surfaced automatically by IntelliSource",
         Inches(0.3), Inches(0.9), Inches(12.5), Inches(0.4),
         size=13, color=KPMG_LIGHT, italic=True)
divider(s, Inches(1.35), KPMG_GOLD)

# 4 SOD types
sod_types = [
    ("S7a", "PO Create vs Release",
     "Same user who created the PO also approved/released it via change log FRGZU field.",
     "po_dump  ×  change_log (EINKBELEG · EKKO · FRGZU)"),
    ("S7b", "PO Create vs GRN Post",
     "Same user created the purchase order and subsequently posted the goods receipt.",
     "po_dump  ×  grn_dump  (purchasing_document + item match)"),
    ("S7c", "GRN Post vs Invoice Post",
     "Same user who posted the goods receipt also created the corresponding vendor invoice.",
     "grn_dump  ×  po_invoice_dump  (debit_credit_ind = S)"),
    ("S7d", "Invoice Post vs Payment",
     "Same user who posted the vendor invoice also cleared the outgoing payment — highest risk.",
     "invoice_dump  ×  payment_dump  (vendor + company_code + cleared_invoice)"),
]

cx = Inches(0.2)
for code, title, desc, tables in sod_types:
    cw = Inches(3.15)
    add_rect(s, cx, Inches(1.5), cw, Inches(4.5), RGBColor(0x0A, 0x1A, 0x3A))
    add_rect(s, cx, Inches(1.5), cw, Inches(0.45), KPMG_RED)
    add_text(s, code, cx + Inches(0.1), Inches(1.55), Inches(0.65), Inches(0.35),
             size=13, bold=True, color=WHITE)
    add_text(s, title, cx + Inches(0.65), Inches(1.55), cw - Inches(0.75), Inches(0.35),
             size=11, bold=True, color=WHITE)
    add_text(s, desc, cx + Inches(0.1), Inches(2.05), cw - Inches(0.2), Inches(1.4),
             size=10, color=RGBColor(0xB0, 0xC8, 0xFF), wrap=True)
    add_rect(s, cx + Inches(0.1), Inches(3.55), cw - Inches(0.2), Inches(0.02), KPMG_MED)
    add_text(s, "Tables joined:", cx + Inches(0.1), Inches(3.65), cw - Inches(0.2), Inches(0.28),
             size=8, bold=True, color=KPMG_LIGHT)
    add_text(s, tables, cx + Inches(0.1), Inches(3.95), cw - Inches(0.2), Inches(0.8),
             size=8, color=KPMG_LIGHT, italic=True, wrap=True)
    cx += cw + Inches(0.1)

# Result stat bar
add_rect(s, Inches(0.2), Inches(6.1), Inches(12.9), Inches(0.85), KPMG_RED)
add_text(s, "187 SOD Conflicts",
         Inches(0.4), Inches(6.18), Inches(4.5), Inches(0.65),
         size=26, bold=True, color=WHITE)
add_text(s,
    "Detected across all 4 control points on first data load  ·  "
    "Popup shows: Document · SOD Type · Vendor · Conflicting User · Date  ·  "
    "Export to Excel for audit team",
    Inches(4.8), Inches(6.25), Inches(8.2), Inches(0.55),
    size=10, color=WHITE, wrap=True)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 8 — VENDOR PERFORMANCE DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
kpmg_header(s, "Vendor Performance Dashboard",
            "Compliance · Lead Time · Spend Concentration · Health Breakdown",
            accent=KPMG_TEAL)
kpmg_footer(s)

add_image(s, ss("2.24.04 PM"), Inches(0.2), Inches(1.22), Inches(7.8), Inches(2.75))
add_image(s, ss("2.24.14 PM"), Inches(0.2), Inches(4.05), Inches(7.8), Inches(2.77))

rx = Inches(8.2)
rw = Inches(4.95)
add_rect(s, rx, Inches(1.22), rw, Inches(5.6), KPMG_LTGRAY)
section_header(s, "VENDOR KPIs", Inches(1.25))

kpis_vend = [
    ("Active Vendor Count", "11", "Not deleted · not purchasing-blocked", KPMG_TEAL),
    ("Vendor Compliance Rate", "84.6%", "Not blocked & not deleted ÷ total · target ≥90%", ORANGE_WARN),
    ("Blocked Vendor Count", "2", "Central purchasing block or posting block = X", KPMG_RED),
    ("Avg Delivery Delay", "5.1 days", "Late deliveries only (days past expected delivery)", KPMG_MED),
]
ky = Inches(1.7)
for label, val, note, color in kpis_vend:
    add_rect(s, rx + Inches(0.1), ky, rw - Inches(0.2), Inches(1.1), WHITE)
    add_rect(s, rx + Inches(0.1), ky, Inches(0.06), Inches(1.1), color)
    add_text(s, label, rx + Inches(0.25), ky + Inches(0.08), rw - Inches(0.5), Inches(0.28),
             size=8.5, color=KPMG_GRAY)
    add_text(s, val, rx + Inches(0.25), ky + Inches(0.35), rw - Inches(0.5), Inches(0.42),
             size=22, bold=True, color=color)
    add_text(s, note, rx + Inches(0.25), ky + Inches(0.78), rw - Inches(0.5), Inches(0.28),
             size=7.5, color=KPMG_GRAY, italic=True, wrap=True)
    ky += Inches(1.2)

divider(s, ky + Inches(0.05), KPMG_LIGHT)
add_text(s, "VENDOR HEALTH BREAKDOWN", rx + Inches(0.1), ky + Inches(0.15), rw - Inches(0.2), Inches(0.28),
         size=9, bold=True, color=KPMG_NAVY)
vendor_seg = [
    ("11 Active", KPMG_TEAL), ("2 Non-Active", KPMG_GRAY),
    ("1 One-Time", KPMG_GOLD), ("10 Domestic", KPMG_MED),
    ("2 International", KPMG_LIGHT), ("2 MSME", KPMG_NAVY),
]
bx = rx + Inches(0.12)
by = ky + Inches(0.5)
for i, (seg, color) in enumerate(vendor_seg):
    cx_ = bx + (i % 2) * Inches(2.35)
    cy_ = by + (i // 2) * Inches(0.36)
    add_rect(s, cx_, cy_, Inches(0.18), Inches(0.24), color)
    add_text(s, seg, cx_ + Inches(0.22), cy_, Inches(2.0), Inches(0.28),
             size=8.5, color=KPMG_NAVY)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 9 — UTILIZATION / CAPEX-OPEX DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
kpmg_header(s, "CAPEX / OPEX Dashboard",
            "Capital vs Operational Expenditure — by Category, Department and Monthly Trend",
            accent=KPMG_LIGHT)
kpmg_footer(s)

add_image(s, ss("2.24.43 PM"), Inches(0.2), Inches(1.22), Inches(7.8), Inches(2.75))
add_image(s, ss("2.24.54 PM"), Inches(0.2), Inches(4.05), Inches(7.8), Inches(2.77))

rx = Inches(8.2)
rw = Inches(4.95)
add_rect(s, rx, Inches(1.22), rw, Inches(5.6), KPMG_LTGRAY)
section_header(s, "CAPEX / OPEX KPIs", Inches(1.25))

kpis_util = [
    ("Total CAPEX Spend", "₹1,899.80 Cr", "Capital: hardware · electrical · assets  (48.3%)", KPMG_NAVY),
    ("Total OPEX Spend", "₹2,036.54 Cr", "Operational: services · maintenance · logistics  (51.7%)", KPMG_TEAL),
    ("CAPEX PO Count", "57 POs", "Distinct CAPEX POs this fiscal year", KPMG_MED),
    ("OPEX PO Count", "71 POs", "Distinct OPEX POs this fiscal year", KPMG_LIGHT),
]
ky = Inches(1.7)
for label, val, note, color in kpis_util:
    add_rect(s, rx + Inches(0.1), ky, rw - Inches(0.2), Inches(1.1), WHITE)
    add_rect(s, rx + Inches(0.1), ky, Inches(0.06), Inches(1.1), color)
    add_text(s, label, rx + Inches(0.25), ky + Inches(0.08), rw - Inches(0.5), Inches(0.28),
             size=8.5, color=KPMG_GRAY)
    add_text(s, val, rx + Inches(0.25), ky + Inches(0.35), rw - Inches(0.5), Inches(0.42),
             size=18, bold=True, color=color)
    add_text(s, note, rx + Inches(0.25), ky + Inches(0.78), rw - Inches(0.5), Inches(0.28),
             size=7.5, color=KPMG_GRAY, italic=True, wrap=True)
    ky += Inches(1.2)

divider(s, ky + Inches(0.05), KPMG_LIGHT)
add_text(s, "ADDITIONAL ANALYTICS", rx + Inches(0.1), ky + Inches(0.15), rw - Inches(0.2), Inches(0.28),
         size=9, bold=True, color=KPMG_NAVY)
util_bullets = [
    "Avg CAPEX PO Value: ₹27.14 Cr  |  OPEX: ₹21.90 Cr",
    "CAPEX Pending (undelivered): ₹1,282.37 Cr",
    "OPEX Pending (undelivered): ₹1,580.89 Cr",
    "OPEX by Department: Consulting 82.6% dominant",
    "Vendor GRN Fill Rate: Wipro, L&T, Reliance ~100%",
    "Delivery Utilisation: 97.4%  |  Delivery Complete: 36.8%",
]
by = ky + Inches(0.48)
for b in util_bullets:
    add_text(s, f"▸  {b}", rx + Inches(0.12), by, rw - Inches(0.25), Inches(0.28),
             size=8, color=KPMG_NAVY, wrap=True)
    by += Inches(0.31)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 10 — PROFIT CENTER MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
kpmg_header(s, "Profit Center Management",
            "39 Active Profit Centers · CAPEX/OPEX Classification · Budget vs Actual Tracking",
            accent=KPMG_GOLD)
kpmg_footer(s)

add_image(s, ss("2.25.30 PM"), Inches(0.2), Inches(1.22), Inches(8.2), Inches(5.6))

rx = Inches(8.6)
rw = Inches(4.55)
add_rect(s, rx, Inches(1.22), rw, Inches(5.6), KPMG_LTGRAY)
section_header(s, "PROFIT CENTER KPIs", Inches(1.25))

pc_kpis = [
    ("Active Profit Centers", "39", "Across all departments and plants", KPMG_GOLD),
    ("Total CAPEX Spend", "₹1,941.4 Cr", "Actual CAPEX across all profit centres", KPMG_NAVY),
    ("Total OPEX Spend", "₹2,020.6 Cr", "Actual OPEX across all profit centres", KPMG_TEAL),
    ("Total Portfolio Spend", "₹3,962.0 Cr", "Combined CAPEX + OPEX spend", KPMG_MED),
]
ky = Inches(1.7)
for label, val, note, color in pc_kpis:
    add_rect(s, rx + Inches(0.1), ky, rw - Inches(0.2), Inches(1.1), WHITE)
    add_rect(s, rx + Inches(0.1), ky, Inches(0.06), Inches(1.1), color)
    add_text(s, label, rx + Inches(0.25), ky + Inches(0.08), rw - Inches(0.45), Inches(0.28),
             size=8.5, color=KPMG_GRAY)
    add_text(s, val, rx + Inches(0.25), ky + Inches(0.35), rw - Inches(0.45), Inches(0.42),
             size=18, bold=True, color=color)
    add_text(s, note, rx + Inches(0.25), ky + Inches(0.78), rw - Inches(0.45), Inches(0.28),
             size=7.5, color=KPMG_GRAY, italic=True, wrap=True)
    ky += Inches(1.2)

divider(s, ky + Inches(0.05), KPMG_LIGHT)
add_text(s, "TABLE COLUMNS", rx + Inches(0.1), ky + Inches(0.15), rw - Inches(0.2), Inches(0.28),
         size=9, bold=True, color=KPMG_NAVY)
pc_cols = [
    "PC Code · Name · Department · Plant",
    "Material Group · CAPEX/OPEX Flag",
    "Budget CAPEX (Cr) · Budget OPEX (Cr)",
    "Actual CAPEX (Cr) · Actual OPEX (Cr)",
    "Edit · Delete actions per profit center",
]
by = ky + Inches(0.48)
for b in pc_cols:
    add_text(s, f"▸  {b}", rx + Inches(0.12), by, rw - Inches(0.25), Inches(0.28),
             size=8.5, color=KPMG_NAVY, wrap=True)
    by += Inches(0.3)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 11 — P2P LIFECYCLE TRACKER
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
kpmg_header(s, "P2P Lifecycle Tracker",
            "End-to-End Procure-to-Pay Flow · Stage Health · Bottlenecks · Process Variants",
            accent=KPMG_MED)
kpmg_footer(s)

add_image(s, ss("2.26.10 PM"), Inches(0.2), Inches(1.22), Inches(7.8), Inches(5.6))

rx = Inches(8.2)
rw = Inches(4.95)
add_rect(s, rx, Inches(1.22), rw, Inches(5.6), KPMG_LTGRAY)
section_header(s, "P2P FUNNEL (Q2 FY24)", Inches(1.25))

funnel_stages = [
    ("1", "PR Created",       "132", "100%", KPMG_RED),
    ("2", "PR Approved",      "132", "100%", ORANGE_WARN),
    ("3", "PO Created",       "163", "100%", KPMG_GOLD),
    ("4", "PO Approved",      "158", "97%",  GREEN_OK),
    ("5", "GRN Posted",       "117", "72%",  GREEN_OK),
    ("6", "Invoice Posted",   "106", "91%",  GREEN_OK),
    ("7", "Payment Made",     "82",  "77%",  GREEN_OK),
]
ky = Inches(1.7)
for num, stage, cases, rate, color in funnel_stages:
    add_rect(s, rx + Inches(0.1), ky, rw - Inches(0.2), Inches(0.6), WHITE)
    add_rect(s, rx + Inches(0.1), ky, Inches(0.22), Inches(0.6), color)
    add_text(s, num, rx + Inches(0.1), ky + Inches(0.12),
             Inches(0.22), Inches(0.38), size=10, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, stage, rx + Inches(0.37), ky + Inches(0.06),
             Inches(2.5), Inches(0.28), size=9, bold=True, color=KPMG_NAVY)
    add_text(s, f"{cases} cases · {rate}", rx + Inches(0.37), ky + Inches(0.33),
             Inches(2.5), Inches(0.24), size=8.5, color=KPMG_GRAY)
    ky += Inches(0.66)

divider(s, ky + Inches(0.05), KPMG_LIGHT)
add_text(s, "SUMMARY METRICS", rx + Inches(0.1), ky + Inches(0.12), rw - Inches(0.2), Inches(0.28),
         size=9, bold=True, color=KPMG_NAVY)
p2p_sum = [
    "Total Cases: 163  |  Avg Cycle Time: 44.5 days",
    "Maverick POs: 31  (flagged for review)",
    "GRN Returns: 3  |  Credit Memos: 0  |  Payments: 82",
    "PR→PO: 25.9d  |  PO→GRN: 33.9d  |  GRN→Invoice: 8.0d",
]
by = ky + Inches(0.45)
for b in p2p_sum:
    add_text(s, f"▸  {b}", rx + Inches(0.12), by, rw - Inches(0.25), Inches(0.28),
             size=8, color=KPMG_NAVY, wrap=True)
    by += Inches(0.32)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 12 — OPERATIONS: VENDOR REPOSITORY & DATA UPLOAD
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
kpmg_header(s, "Operations Modules",
            "Vendor Repository · Data Upload · Activity History · Ask IntelliSource",
            accent=KPMG_TEAL)
kpmg_footer(s)

# Vendor Repository — top-left
add_text(s, "Vendor Repository", Inches(0.2), Inches(1.28), Inches(6.3), Inches(0.35),
         size=12, bold=True, color=KPMG_NAVY)
add_image(s, ss("2.26.31 PM"), Inches(0.2), Inches(1.65), Inches(6.3), Inches(2.5))

# Data Upload — top-right
add_text(s, "Data Upload", Inches(6.75), Inches(1.28), Inches(6.3), Inches(0.35),
         size=12, bold=True, color=KPMG_NAVY)
add_image(s, ss("2.26.49 PM"), Inches(6.75), Inches(1.65), Inches(6.3), Inches(2.5))

# Bottom: descriptions + Activity History + User Management thumbnails
add_image(s, ss("2.26.58 PM"), Inches(0.2), Inches(4.3), Inches(3.0), Inches(2.0))
add_image(s, ss("2.27.24 PM"), Inches(3.4), Inches(4.3), Inches(3.0), Inches(2.0))

# Description text
add_rect(s, Inches(6.6), Inches(4.3), Inches(6.55), Inches(2.0), KPMG_LTGRAY)
add_rect(s, Inches(6.6), Inches(4.3), Inches(6.55), Inches(0.35), KPMG_NAVY)
add_text(s, "MODULE CAPABILITIES", Inches(6.72), Inches(4.34), Inches(6.3), Inches(0.28),
         size=9, bold=True, color=WHITE)
ops_items = [
    ("Vendor Repository:", "13 vendors · searchable catalog · category filter (IT/Consulting/Cloud) · grid & list view"),
    ("Data Upload:", "CSV/xlsx/xls up to 50 MB · 6 dataset types auto-detected from column headers · real-time validation"),
    ("Activity History:", "Record of all uploads and report downloads · Total Events · Success/Fail tracking"),
    ("User Management:", "Role-based access · Admin + Procurement Manager · Add/Edit users · Created date tracking"),
    ("Ask IntelliSource:", "AI natural language query interface · ad-hoc questions without SQL or analyst involvement"),
]
iy = Inches(4.72)
for title, desc in ops_items:
    add_text(s, title, Inches(6.72), iy, Inches(1.6), Inches(0.22),
             size=8.5, bold=True, color=KPMG_NAVY)
    add_text(s, desc, Inches(8.45), iy, Inches(4.55), Inches(0.22),
             size=8.5, color=KPMG_GRAY, wrap=True)
    iy += Inches(0.28)

add_text(s, "Activity History", Inches(0.2), Inches(4.28), Inches(3.0), Inches(0.25),
         size=9, bold=True, color=KPMG_GRAY)
add_text(s, "User Management", Inches(3.4), Inches(4.28), Inches(3.0), Inches(0.25),
         size=9, bold=True, color=KPMG_GRAY)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 13 — DATA ARCHITECTURE
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
kpmg_header(s, "Data Architecture", "SAP Source → IntelliSource Table → Dashboard KPI")
kpmg_footer(s)

add_text(s,
    "IntelliSource ingests CSV exports from SAP standard transactions. "
    "ETL layer deduplicates, validates, and classifies rows. "
    "All KPIs recompute across all dashboards in < 90 seconds on upload.",
    Inches(0.2), Inches(1.22), Inches(12.9), Inches(0.45),
    size=11, color=KPMG_GRAY, italic=True)

rows_data = [
    ("ME5A / EBAN",   "pr_dump",           "Purchase Requisitions",     "Procurement · Leadership · P2P Tracker"),
    ("ME2M / EKKO",   "po_dump",           "Purchase Orders",           "All 5 Dashboards"),
    ("MB51 / MKPF",   "grn_dump",          "Goods Receipts (GRN)",      "Financial · Leadership · Vendor · SOD"),
    ("MIR6 / RBKP",   "po_invoice_dump",   "PO Invoice Linkage",        "SOD S7c · P2P Tracker · Duplicate Check"),
    ("FBL1N / BKPF",  "invoice_dump",      "AP Invoices",               "Financial · Leadership · SOD S7d"),
    ("F110 / BKPF",   "payment_dump",      "Outgoing Payments",         "Financial · Leadership · P2P · SOD"),
    ("XK03 / LFA1",   "vendor_master",     "Vendor Master Data",        "Vendor Performance · Compliance"),
    ("AUT10 / CDHDR", "change_log",        "PO Change History",         "SOD S7a: PO Create vs Release"),
    ("ME2L / EKET",   "po_delivery_dump",  "Delivery Schedules",        "Vendor Lead Time · GRN Fill Rate"),
]

hx = Inches(0.2)
hy = Inches(1.8)
col_ws = [Inches(2.5), Inches(2.6), Inches(3.3), Inches(4.7)]
col_heads = ["SAP Transaction / Table", "IntelliSource Table", "What It Captures", "Drives These KPIs"]
col_colors = [KPMG_NAVY, KPMG_MED, KPMG_GRAY, KPMG_TEAL]

cx2 = hx
for ch, cw, cc in zip(col_heads, col_ws, col_colors):
    add_rect(s, cx2, hy, cw - Inches(0.04), Inches(0.42), cc)
    add_text(s, ch, cx2 + Inches(0.1), hy + Inches(0.08),
             cw - Inches(0.2), Inches(0.3), size=10, bold=True, color=WHITE)
    cx2 += cw

for ri, (tcode, table, what, kpis) in enumerate(rows_data):
    ry = hy + Inches(0.44) + ri * Inches(0.52)
    bg = WHITE if ri % 2 == 0 else KPMG_LTGRAY
    cx2 = hx
    for val, cw in zip([tcode, table, what, kpis], col_ws):
        add_rect(s, cx2, ry, cw - Inches(0.04), Inches(0.48), bg)
        add_text(s, val, cx2 + Inches(0.1), ry + Inches(0.1),
                 cw - Inches(0.2), Inches(0.35),
                 size=9.5, color=KPMG_MED if val == table else BLACK,
                 bold=(val == table))
        cx2 += cw


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 14 — ALERT CENTER & KEY RISK INDICATORS
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
kpmg_header(s, "Alert Center & Risk Indicators",
            "Live Alerts Across All Dashboards · Proactive Governance Layer",
            accent=KPMG_RED)
kpmg_footer(s)

# Left: Alert categories
lw = Inches(6.3)
add_rect(s, Inches(0.2), Inches(1.22), lw, Inches(5.6), KPMG_LTGRAY)
section_header(s, "ACTIVE ALERTS  —  7 Total (4 Critical · 3 Warning)", Inches(1.25))

alerts = [
    ("CRITICAL", "Duplicate Invoice Risk",
     "Same vendor + amount + date detected. Payment not yet cleared. Requires Finance review before release.",
     KPMG_RED),
    ("CRITICAL", "Blocked Vendor — Active POs",
     "2 vendors with active purchasing blocks still have open purchase orders in system.",
     KPMG_RED),
    ("CRITICAL", "Payment Before GRN",
     "Outgoing payment cleared before goods receipt posted — 3-way match breakdown.",
     KPMG_RED),
    ("CRITICAL", "High SOD Conflict Count",
     "187 SOD violations across 4 control points — internal audit notification recommended.",
     KPMG_RED),
    ("WARNING",  "Maverick Spend Above 15% Threshold",
     "19% of POs created without approved purchase requisition — procurement policy breach.",
     ORANGE_WARN),
    ("WARNING",  "3-Way Match Below 90%",
     "Current match rate 84% — OPEX POs with mismatched GRN quantities flagged.",
     ORANGE_WARN),
    ("WARNING",  "Vendor Compliance Below 90%",
     "84.6% compliance rate — 2 blocked vendors and 1 one-time vendor require review.",
     ORANGE_WARN),
]
ay = Inches(1.72)
for severity, title, body, color in alerts:
    ah = Inches(0.72)
    add_rect(s, Inches(0.25), ay, lw - Inches(0.1), ah, WHITE)
    add_rect(s, Inches(0.25), ay, Inches(0.05), ah, color)
    add_rect(s, Inches(0.35), ay + Inches(0.06), Inches(1.0), Inches(0.28), color)
    add_text(s, severity, Inches(0.35), ay + Inches(0.08), Inches(1.0), Inches(0.24),
             size=7, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, title, Inches(1.45), ay + Inches(0.06), lw - Inches(1.4), Inches(0.28),
             size=9.5, bold=True, color=color)
    add_text(s, body, Inches(1.45), ay + Inches(0.35), lw - Inches(1.4), Inches(0.32),
             size=8.5, color=KPMG_GRAY, wrap=True)
    ay += Inches(0.78)

# Right: Risk summary cards
rx = Inches(6.75)
rw = Inches(6.4)
add_rect(s, rx, Inches(1.22), rw, Inches(5.6), KPMG_NAVY)
section_header(s, "RISK SUMMARY", Inches(1.25))

risk_items = [
    ("SOD Conflicts", "187", "Across PO-Release, PO-GRN, GRN-Invoice, Invoice-Payment", KPMG_RED),
    ("Maverick Rate", "19.0%", "POs without approved PR — policy violation", ORANGE_WARN),
    ("3-Way Match", "84.0%", "Below 90% SLA threshold — invoice risk", ORANGE_WARN),
    ("Blocked Vendors", "2", "Active purchasing blocks in vendor master", KPMG_RED),
    ("High-Value POs", "85", "Above ₹1 Cr threshold — requires dual approval", KPMG_GOLD),
    ("End-to-End Cycle", "44.5 days", "Bottleneck: PO→GRN stage (33.9 days avg)", KPMG_LIGHT),
]
ky = Inches(1.72)
for label, val, note, color in risk_items:
    add_rect(s, rx + Inches(0.1), ky, rw - Inches(0.2), Inches(0.82), RGBColor(0x05, 0x1A, 0x3C))
    add_rect(s, rx + Inches(0.1), ky, Inches(0.05), Inches(0.82), color)
    add_text(s, label, rx + Inches(0.25), ky + Inches(0.06),
             Inches(2.5), Inches(0.25), size=8.5, color=KPMG_LIGHT)
    add_text(s, val, rx + Inches(2.8), ky + Inches(0.06),
             Inches(2.8), Inches(0.25), size=14, bold=True, color=color, align=PP_ALIGN.RIGHT)
    add_text(s, note, rx + Inches(0.25), ky + Inches(0.5),
             rw - Inches(0.5), Inches(0.28), size=8, color=KPMG_GRAY, wrap=True, italic=True)
    ky += Inches(0.88)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 15 — INTELLISOURCE vs SAP NATIVE
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
kpmg_header(s, "IntelliSource vs SAP Native",
            "Why IntelliSource — Beyond What SAP Standard Reporting Provides")
kpmg_footer(s)

lx, rx = Inches(0.2), Inches(6.75)
pw = Inches(6.3)
py = Inches(1.25)
ph = Inches(5.55)

add_rect(s, lx, py, pw, ph, KPMG_LTGRAY)
add_rect(s, lx, py, pw, Inches(0.5), KPMG_GRAY)
add_text(s, "SAP Standard — What You Do Today",
         lx + Inches(0.12), py + Inches(0.08), pw - Inches(0.2), Inches(0.38),
         size=13, bold=True, color=WHITE)

sap_pain = [
    "6–8 transaction codes for complete P2P visibility",
    "Cross-document SOD check = manual VLOOKUP",
    "Maverick spend = ME2M + manual PR comparison",
    "Duplicate invoices = no standard detection report",
    "CAPEX/OPEX split = export + manual classification",
    "P2P cycle time = multiple reports + spreadsheet",
    "Vendor compliance = offline master data review",
    "Alerts = weekly email, batch, next-morning view",
    "SAP data as-is: no deduplication or enrichment",
    "Every question = analyst + Excel + 2–3 days",
]
iy = py + Inches(0.65)
for item in sap_pain:
    add_text(s, f"✕  {item}", lx + Inches(0.18), iy,
             pw - Inches(0.3), Inches(0.35), size=10.5, color=KPMG_RED, wrap=True)
    iy += Inches(0.38)

add_rect(s, rx, py, pw, ph, KPMG_NAVY)
add_rect(s, rx, py, pw, Inches(0.5), KPMG_MED)
add_text(s, "IntelliSource — What You Get Now",
         rx + Inches(0.12), py + Inches(0.08), pw - Inches(0.2), Inches(0.38),
         size=13, bold=True, color=WHITE)

is_gains = [
    "5 role-specific dashboards — one upload, everything live",
    "SOD conflicts auto-detected across all 4 control points",
    "Maverick spend flagged from PO data in real-time",
    "Duplicate invoice detection before payment clears",
    "CAPEX/OPEX: auto-classified, live, drill to PO line level",
    "P2P cycle: PR → PO → GRN → Invoice → Payment automated",
    "Vendor compliance: 5-block flag check, live per upload",
    "Alert Center: real-time banners across every dashboard",
    "ETL validates, deduplicates, enriches on upload",
    "Ask IntelliSource: natural language — answer in seconds",
]
iy = py + Inches(0.65)
for item in is_gains:
    add_text(s, f"✓  {item}", rx + Inches(0.18), iy,
             pw - Inches(0.3), Inches(0.35), size=10.5, color=KPMG_LIGHT, wrap=True)
    iy += Inches(0.38)

# VS divider
add_rect(s, Inches(6.55), Inches(2.0), Inches(0.15), Inches(4.0), KPMG_GOLD)
add_text(s, "VS", Inches(6.48), Inches(3.85), Inches(0.33), Inches(0.45),
         size=14, bold=True, color=KPMG_GOLD, align=PP_ALIGN.CENTER)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 16 — NEXT STEPS & CALL TO ACTION
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, KPMG_NAVY)
add_rect(s, 0, 0, Inches(0.12), SLIDE_H, KPMG_GOLD)
kpmg_footer(s)

add_text(s, "Next Steps", Inches(0.3), Inches(0.2), Inches(12), Inches(0.75),
         size=36, bold=True, color=WHITE)
add_text(s, "From Demo to Live Deployment — Week-by-Week",
         Inches(0.3), Inches(0.9), Inches(12), Inches(0.4),
         size=14, color=KPMG_LIGHT, italic=True)
divider(s, Inches(1.4), KPMG_GOLD)

steps = [
    ("Week 1", "Data Readiness Check",
     "Confirm SAP export access for 5 core transactions: ME2M, MB51, FBL1N, F110, XK03. "
     "Identify company codes, fiscal year scope, and data volume.",
     KPMG_RED),
    ("Week 2", "Pilot Data Upload",
     "Single company code. Upload CSV exports to IntelliSource. Validate all KPI logic against "
     "your actual data. Identify any data quality issues in source.",
     ORANGE_WARN),
    ("Week 3", "Stakeholder Walkthrough",
     "60-minute demo with Procurement + Finance + Internal Audit. Walk through dashboards, "
     "SOD conflict popup, P2P tracker, and alert center with real data.",
     KPMG_GOLD),
    ("Week 4", "Go / No-Go Decision",
     "Full deployment across remaining company codes, or phased rollout plan. "
     "Define user roles, access levels, and reporting cadence.",
     GREEN_OK),
]
sy = Inches(1.6)
for wk, title, desc, color in steps:
    add_rect(s, Inches(0.3), sy, Inches(12.7), Inches(1.22), RGBColor(0x05, 0x1A, 0x3C))
    add_rect(s, Inches(0.3), sy, Inches(1.5), Inches(1.22), color)
    add_text(s, wk, Inches(0.3), sy + Inches(0.12), Inches(1.5), Inches(0.4),
             size=14, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, title, Inches(2.0), sy + Inches(0.1), Inches(10.8), Inches(0.38),
             size=13, bold=True, color=color)
    add_text(s, desc, Inches(2.0), sy + Inches(0.48), Inches(10.8), Inches(0.65),
             size=10, color=RGBColor(0xB0, 0xC8, 0xFF), wrap=True)
    sy += Inches(1.32)

# ROI bar
add_rect(s, Inches(0.3), Inches(6.55), Inches(12.7), Inches(0.5), KPMG_MED)
roi_text = (
    "Estimated Impact:  "
    "₹50–250 Lakhs duplicate recovery (Y1)  ·  "
    "₹20–80 Lakhs per SOD finding avoided  ·  "
    "800+ analyst hours saved/year  ·  "
    "3–5 day go-live"
)
add_text(s, roi_text, Inches(0.45), Inches(6.6), Inches(12.3), Inches(0.38),
         size=10, color=WHITE)


# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 17 — THANK YOU / CONTACT
# ═══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, SLIDE_W, SLIDE_H, KPMG_NAVY)
add_rect(s, 0, 0, Inches(0.12), SLIDE_H, KPMG_LIGHT)
add_rect(s, Inches(10.2), 0, Inches(3.13), Inches(2.8), KPMG_MED)
add_rect(s, Inches(11.3), 0, Inches(2.03), Inches(1.5), KPMG_LIGHT)

add_text(s, "KPMG", Inches(0.3), Inches(0.35), Inches(4), Inches(0.9),
         size=42, bold=True, color=WHITE)
add_text(s, "India  |  Procurement Advisory",
         Inches(0.3), Inches(1.25), Inches(6), Inches(0.38),
         size=14, color=KPMG_LIGHT)

divider(s, Inches(1.8), KPMG_GOLD)

add_text(s, "Thank You", Inches(0.3), Inches(2.0), Inches(12), Inches(1.0),
         size=52, bold=True, color=WHITE)
add_text(s, "IntelliSource — Procurement Intelligence, Powered by KPMG",
         Inches(0.3), Inches(3.0), Inches(12), Inches(0.5),
         size=18, color=KPMG_LIGHT)

divider(s, Inches(3.65), KPMG_LIGHT)

contact_items = [
    "Platform:   IntelliSource — SAP P2P Intelligence & Analytics",
    "Period:      Q2 FY2024  |  All Companies",
    "Data:        ₹3,936 Cr spend · 187 SOD conflicts · 44.5d P2P cycle",
    "Contact:    getdev24@gmail.com",
    "Status:      Pilot Available — 3-5 day deployment per company code",
]
cy = Inches(3.85)
for item in contact_items:
    add_text(s, item, Inches(0.3), cy, Inches(9), Inches(0.38),
             size=13, color=RGBColor(0xB8, 0xD0, 0xFF))
    cy += Inches(0.46)

add_rect(s, 0, Inches(6.9), SLIDE_W, Inches(0.6), KPMG_MED)
add_text(s, "KPMG India  |  Advisory  |  Procurement Excellence  |  CONFIDENTIAL",
         Inches(0.3), Inches(6.97), Inches(10), Inches(0.4),
         size=11, color=WHITE)
add_text(s, "2026",
         Inches(12.3), Inches(6.97), Inches(0.9), Inches(0.4),
         size=11, bold=True, color=KPMG_GOLD, align=PP_ALIGN.RIGHT)


# ── Save ───────────────────────────────────────────────────────────────────────
out = os.path.join(os.path.dirname(__file__), "IntelliSource_Presentation.pptx")
prs.save(out)
print(f"Saved: {out}")
print(f"Slides: {len(prs.slides)}")
