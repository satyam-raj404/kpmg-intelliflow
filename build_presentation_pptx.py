"""Build IntelliSource_Presentation.pptx — minimal demo deck, screenshots-first."""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

KPMG_NAVY  = RGBColor(0x00, 0x33, 0x8D)
KPMG_MED   = RGBColor(0x00, 0x5E, 0xB8)
KPMG_LIGHT = RGBColor(0x00, 0x91, 0xDA)
KPMG_TEAL  = RGBColor(0x00, 0x99, 0xA8)
KPMG_GOLD  = RGBColor(0x8F, 0x73, 0x26)
KPMG_RED   = RGBColor(0xBC, 0x20, 0x4B)
KPMG_GRAY  = RGBColor(0x63, 0x66, 0x6A)
WHITE      = RGBColor(0xFF, 0xFF, 0xFF)
DARK_BG    = RGBColor(0x05, 0x18, 0x35)

SLIDE_W = Inches(13.33)
SLIDE_H = Inches(7.5)

SCREENSHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app_screenshots")
_NNBSP = chr(0x202F)  # narrow no-break space in macOS screenshot filenames

def ss(name):
    fname = f"Screenshot 2026-07-08 at {name}.png".replace(" PM", f"{_NNBSP}PM").replace(" AM", f"{_NNBSP}AM")
    return os.path.join(SCREENSHOTS, fname)


prs = Presentation()
prs.slide_width  = SLIDE_W
prs.slide_height = SLIDE_H
BLANK = prs.slide_layouts[6]


# ── helpers ────────────────────────────────────────────────────────────────────

def rect(slide, x, y, w, h, fill):
    sh = slide.shapes.add_shape(1, x, y, w, h)
    sh.line.fill.background()
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    return sh


def txt(slide, text, x, y, w, h, size=12, bold=False, color=WHITE,
        align=PP_ALIGN.LEFT, italic=False):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = color
    r.font.name = "Calibri"


def img(slide, path, x, y, w, h):
    if os.path.exists(path):
        slide.shapes.add_picture(path, x, y, w, h)
    else:
        rect(slide, x, y, w, h, KPMG_GRAY)
        txt(slide, "screenshot", x + Inches(0.1), y + h / 2, w, Inches(0.3),
            size=9, italic=True, color=WHITE)


def footer(slide, label=""):
    rect(slide, 0, Inches(7.15), SLIDE_W, Inches(0.35), KPMG_NAVY)
    if label:
        txt(slide, label, Inches(0.2), Inches(7.17), Inches(10), Inches(0.28),
            size=8, color=RGBColor(0xAA, 0xC4, 0xE8))
    txt(slide, "KPMG  |  IntelliSource  |  CONFIDENTIAL",
        Inches(9.5), Inches(7.17), Inches(3.7), Inches(0.28),
        size=8, color=KPMG_GOLD, align=PP_ALIGN.RIGHT)


def top_bar(slide, title, sub="", accent=KPMG_LIGHT):
    rect(slide, 0, 0, SLIDE_W, Inches(0.72), KPMG_NAVY)
    rect(slide, 0, 0, Inches(0.08), Inches(0.72), accent)
    txt(slide, title, Inches(0.2), Inches(0.06), Inches(9), Inches(0.42),
        size=22, bold=True, color=WHITE)
    if sub:
        txt(slide, sub, Inches(0.2), Inches(0.46), Inches(11), Inches(0.25),
            size=10, color=KPMG_LIGHT)


def caption_strip(slide, lines, x, y, w, bg=KPMG_NAVY, text_color=WHITE):
    """Thin caption box with 2-3 short bullet lines."""
    h = Inches(0.28 * len(lines) + 0.2)
    rect(slide, x, y, w, h, bg)
    cy = y + Inches(0.1)
    for line in lines:
        txt(slide, f"  {line}", x, cy, w, Inches(0.26), size=9, color=text_color)
        cy += Inches(0.28)
    return h


# ════════════════════════════════════════════════════════════════════════════════
# SLIDE 1 — TITLE
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, SLIDE_W, SLIDE_H, KPMG_NAVY)
rect(s, 0, 0, Inches(0.12), SLIDE_H, KPMG_LIGHT)
rect(s, Inches(9.5), 0, Inches(3.83), Inches(7.5), KPMG_MED)

# screenshot as visual on right
img(s, ss("2.21.57 PM"), Inches(9.6), Inches(0.3), Inches(3.6), Inches(6.9))

txt(s, "KPMG", Inches(0.3), Inches(0.5), Inches(5), Inches(0.8),
    size=38, bold=True, color=WHITE)
txt(s, "India  |  Procurement Advisory",
    Inches(0.3), Inches(1.28), Inches(5.5), Inches(0.36),
    size=13, color=KPMG_LIGHT)

rect(s, Inches(0.3), Inches(1.85), Inches(5.5), Inches(0.04), KPMG_GOLD)

txt(s, "IntelliSource",
    Inches(0.3), Inches(2.05), Inches(9.0), Inches(1.3),
    size=56, bold=True, color=WHITE)
txt(s, "SAP Procurement Intelligence Platform",
    Inches(0.3), Inches(3.35), Inches(8.8), Inches(0.55),
    size=20, color=KPMG_LIGHT)

rect(s, Inches(0.3), Inches(4.05), Inches(5.5), Inches(0.04), KPMG_LIGHT)

kpis = [
    "₹3,936 Cr  Spend Visibility",
    "187  SOD Conflicts Detected",
    "5  Role-Specific Dashboards",
    "44.5 Days  End-to-End P2P",
]
ky = Inches(4.25)
for k in kpis:
    txt(s, k, Inches(0.3), ky, Inches(8.8), Inches(0.38),
        size=13, color=RGBColor(0xC0, 0xD8, 0xFF))
    ky += Inches(0.44)

rect(s, 0, Inches(6.95), SLIDE_W, Inches(0.55), RGBColor(0x00, 0x28, 0x70))
txt(s, "Application Demo  |  Q2 FY2024",
    Inches(0.3), Inches(7.02), Inches(8), Inches(0.35),
    size=10, color=WHITE)
txt(s, "CONFIDENTIAL",
    Inches(11.5), Inches(7.02), Inches(1.7), Inches(0.35),
    size=10, bold=True, color=KPMG_GOLD, align=PP_ALIGN.RIGHT)


# ════════════════════════════════════════════════════════════════════════════════
# SLIDE 2 — PROCUREMENT DASHBOARD
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
top_bar(s, "Procurement Dashboard", "PO Lifecycle · Maverick Spend · Cycle Time")
footer(s, "Audience: Procurement Manager")

# Full-width screenshot
img(s, ss("2.20.51 PM"), Inches(0.15), Inches(0.78), Inches(9.65), Inches(6.25))

# Right panel — KPI callouts
rx = Inches(10.0)
rw = Inches(3.15)

rect(s, rx, Inches(0.78), rw, Inches(6.25), DARK_BG)

kpi_blocks = [
    ("₹71.13 Cr", "Total PO Value", KPMG_LIGHT),
    ("74",        "Active POs",     KPMG_LIGHT),
    ("85",        "High-Value POs\n(above ₹1 Cr)", KPMG_RED),
    ("2.7 Days",  "Avg PO Cycle\nTime", RGBColor(0x00, 0xC8, 0x6E)),
    ("19%",       "Maverick\nSpend Rate", RGBColor(0xFF, 0x8C, 0x00)),
]
ky = Inches(1.0)
for val, label, color in kpi_blocks:
    txt(s, val, rx + Inches(0.18), ky, rw - Inches(0.25), Inches(0.5),
        size=22, bold=True, color=color)
    txt(s, label, rx + Inches(0.18), ky + Inches(0.5), rw - Inches(0.25), Inches(0.42),
        size=9.5, color=RGBColor(0xAA, 0xC4, 0xE8))
    rect(s, rx + Inches(0.18), ky + Inches(0.95), rw - Inches(0.36), Inches(0.02),
         RGBColor(0x1A, 0x35, 0x65))
    ky += Inches(1.12)


# ════════════════════════════════════════════════════════════════════════════════
# SLIDE 3 — FINANCIAL DASHBOARD
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
top_bar(s, "Financial Dashboard", "Payments · 3-Way Match · Duplicate Detection · Invoice Aging",
        accent=KPMG_MED)
footer(s, "Audience: Finance Controller")

# Two screenshots stacked
img(s, ss("2.21.22 PM"), Inches(0.15), Inches(0.78), Inches(9.65), Inches(3.0))
img(s, ss("2.21.34 PM"), Inches(0.15), Inches(3.85), Inches(9.65), Inches(3.1))

rx = Inches(10.0)
rw = Inches(3.15)
rect(s, rx, Inches(0.78), rw, Inches(6.17), DARK_BG)

kpi_blocks = [
    ("₹958 Cr",  "Total Payments\nYTD",         KPMG_LIGHT),
    ("84%",      "3-Way Match\nRate",             RGBColor(0xFF, 0x8C, 0x00)),
    ("40.5 Days","Avg Invoice\nPayment Days",     KPMG_LIGHT),
    ("Live",     "Duplicate Invoice\nDetection",  KPMG_RED),
]
ky = Inches(1.0)
for val, label, color in kpi_blocks:
    txt(s, val, rx + Inches(0.18), ky, rw - Inches(0.25), Inches(0.5),
        size=22, bold=True, color=color)
    txt(s, label, rx + Inches(0.18), ky + Inches(0.5), rw - Inches(0.25), Inches(0.42),
        size=9.5, color=RGBColor(0xAA, 0xC4, 0xE8))
    rect(s, rx + Inches(0.18), ky + Inches(0.95), rw - Inches(0.36), Inches(0.02),
         RGBColor(0x1A, 0x35, 0x65))
    ky += Inches(1.12)


# ════════════════════════════════════════════════════════════════════════════════
# SLIDE 4 — LEADERSHIP DASHBOARD  (SOD focus)
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
top_bar(s, "Leadership Dashboard", "Board View · SOD Conflicts · Risk Indicators · Strategic Spend",
        accent=KPMG_RED)
footer(s, "Audience: CFO · CPO · Board")

img(s, ss("2.21.57 PM"), Inches(0.15), Inches(0.78), Inches(9.65), Inches(3.05))
img(s, ss("2.22.42 PM"), Inches(0.15), Inches(3.9), Inches(9.65), Inches(3.05))

rx = Inches(10.0)
rw = Inches(3.15)
rect(s, rx, Inches(0.78), rw, Inches(6.17), DARK_BG)

kpi_blocks = [
    ("₹3,936 Cr", "Total Spend\nAll Companies",    KPMG_LIGHT),
    ("187",       "SOD Conflicts\n4 Control Points", KPMG_RED),
    ("19%",       "Maverick\nSpend Rate",            RGBColor(0xFF, 0x8C, 0x00)),
    ("44.5 Days", "End-to-End\nP2P Cycle",           KPMG_LIGHT),
    ("85 POs",    "High-Value POs\n> ₹1 Cr",         KPMG_GOLD),
]
ky = Inches(0.95)
for val, label, color in kpi_blocks:
    txt(s, val, rx + Inches(0.18), ky, rw - Inches(0.25), Inches(0.46),
        size=19, bold=True, color=color)
    txt(s, label, rx + Inches(0.18), ky + Inches(0.46), rw - Inches(0.25), Inches(0.38),
        size=9, color=RGBColor(0xAA, 0xC4, 0xE8))
    rect(s, rx + Inches(0.18), ky + Inches(0.87), rw - Inches(0.36), Inches(0.02),
         RGBColor(0x1A, 0x35, 0x65))
    ky += Inches(1.0)


# ════════════════════════════════════════════════════════════════════════════════
# SLIDE 5 — SOD CONFLICTS  (dark, impact slide)
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, SLIDE_W, SLIDE_H, DARK_BG)
rect(s, 0, 0, Inches(0.1), SLIDE_H, KPMG_RED)
footer(s)

txt(s, "Segregation of Duty Conflicts",
    Inches(0.25), Inches(0.18), Inches(12), Inches(0.6),
    size=30, bold=True, color=WHITE)
txt(s, "Automatically detected by IntelliSource — invisible in SAP standard reporting",
    Inches(0.25), Inches(0.75), Inches(12), Inches(0.32),
    size=12, italic=True, color=KPMG_LIGHT)
rect(s, Inches(0.25), Inches(1.12), Inches(12.85), Inches(0.03), KPMG_RED)

# Big number
rect(s, Inches(0.25), Inches(1.3), Inches(3.5), Inches(2.5), KPMG_RED)
txt(s, "187", Inches(0.25), Inches(1.38), Inches(3.5), Inches(1.7),
    size=90, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
txt(s, "SOD Violations\nDetected — First Upload",
    Inches(0.25), Inches(2.95), Inches(3.5), Inches(0.75),
    size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

# 4 SOD types
sods = [
    ("PO Create  →  PO Release",    "Same user created and approved the purchase order"),
    ("PO Create  →  GRN Post",      "Same user raised PO and posted the goods receipt"),
    ("GRN Post  →  Invoice Post",   "Same user received goods and created vendor invoice"),
    ("Invoice Post  →  Payment",    "Same user posted invoice and cleared the payment  ← highest risk"),
]
cy = Inches(1.45)
for title, desc in sods:
    rect(s, Inches(4.1), cy, Inches(9.0), Inches(0.9), RGBColor(0x0A, 0x22, 0x48))
    rect(s, Inches(4.1), cy, Inches(0.06), Inches(0.9), KPMG_RED)
    txt(s, title, Inches(4.3), cy + Inches(0.08), Inches(8.6), Inches(0.35),
        size=12, bold=True, color=WHITE)
    txt(s, desc, Inches(4.3), cy + Inches(0.48), Inches(8.6), Inches(0.35),
        size=10, color=RGBColor(0x90, 0xB8, 0xE8))
    cy += Inches(1.05)

txt(s, "Popup shows: Document  ·  SOD Type  ·  Vendor  ·  User  ·  Date  ·  Export to Excel",
    Inches(0.25), Inches(5.85), Inches(12.85), Inches(0.35),
    size=10, color=KPMG_GOLD, italic=True)


# ════════════════════════════════════════════════════════════════════════════════
# SLIDE 6 — VENDOR PERFORMANCE + UTILIZATION  (split)
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
top_bar(s, "Vendor Performance  &  CAPEX / OPEX Dashboard",
        "Compliance · Lead Time · Spend Split · Department Breakdown",
        accent=KPMG_TEAL)
footer(s)

# Left: Vendor Performance
txt(s, "Vendor Performance", Inches(0.15), Inches(0.82), Inches(6.3), Inches(0.3),
    size=10, bold=True, color=KPMG_GRAY)
img(s, ss("2.24.04 PM"), Inches(0.15), Inches(1.12), Inches(6.3), Inches(2.7))
img(s, ss("2.24.14 PM"), Inches(0.15), Inches(3.9), Inches(6.3), Inches(2.7))

# Right: Utilization
txt(s, "CAPEX / OPEX (Utilization)", Inches(6.7), Inches(0.82), Inches(6.45), Inches(0.3),
    size=10, bold=True, color=KPMG_GRAY)
img(s, ss("2.24.43 PM"), Inches(6.7), Inches(1.12), Inches(6.45), Inches(2.7))
img(s, ss("2.24.54 PM"), Inches(6.7), Inches(3.9), Inches(6.45), Inches(2.7))

# Divider
rect(s, Inches(6.58), Inches(0.82), Inches(0.03), Inches(5.8), KPMG_LIGHT)

# Bottom caption bar
rect(s, 0, Inches(6.65), SLIDE_W, Inches(0.46), KPMG_NAVY)
caps = [
    "11 Active Vendors  ·  84.6% Compliance  ·  2 Blocked  ·  5.1d Avg Delivery Delay",
    "CAPEX ₹1,899 Cr (48.3%)  ·  OPEX ₹2,036 Cr (51.7%)  ·  39 Profit Centres  ·  97.4% Delivery Utilisation",
]
txt(s, caps[0], Inches(0.2), Inches(6.68), Inches(6.3), Inches(0.22),
    size=9, color=KPMG_LIGHT)
txt(s, caps[1], Inches(6.75), Inches(6.68), Inches(6.4), Inches(0.22),
    size=9, color=KPMG_LIGHT)


# ════════════════════════════════════════════════════════════════════════════════
# SLIDE 7 — P2P LIFECYCLE TRACKER + PROFIT CENTERS
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
top_bar(s, "P2P Lifecycle Tracker  &  Profit Centers",
        "End-to-End Procure-to-Pay · Stage Health · 39 Active Profit Centers",
        accent=KPMG_MED)
footer(s)

# Left: P2P Tracker — full height
img(s, ss("2.26.10 PM"), Inches(0.15), Inches(0.82), Inches(8.0), Inches(5.95))

# Right: Profit Centers + caption
img(s, ss("2.25.30 PM"), Inches(8.3), Inches(0.82), Inches(4.85), Inches(4.0))

rect(s, Inches(8.3), Inches(4.88), Inches(4.85), Inches(1.89), DARK_BG)
pc_lines = [
    "39 Active Profit Centers",
    "CAPEX ₹1,941 Cr  ·  OPEX ₹2,021 Cr",
    "Total Portfolio: ₹3,962 Cr",
    "Filter by department · drill to PO line",
]
cy = Inches(5.05)
for line in pc_lines:
    txt(s, f"▸  {line}", Inches(8.45), cy, Inches(4.55), Inches(0.3),
        size=10, color=RGBColor(0xB0, 0xC8, 0xFF))
    cy += Inches(0.35)

# P2P funnel caption
rect(s, Inches(0.15), Inches(6.72), Inches(8.0), Inches(0.35), KPMG_NAVY)
txt(s, "132 PRs  →  163 POs  →  117 GRNs  →  106 Invoices  →  82 Payments  ·  Avg 44.5 Days",
    Inches(0.25), Inches(6.75), Inches(7.8), Inches(0.28), size=9, color=KPMG_LIGHT)


# ════════════════════════════════════════════════════════════════════════════════
# SLIDE 8 — OPERATIONS  (Vendor Repo + Data Upload)
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, SLIDE_W, SLIDE_H, WHITE)
top_bar(s, "Operations",
        "Vendor Repository · Data Upload · User Management · Activity History",
        accent=KPMG_TEAL)
footer(s)

# 4 screenshots in 2×2 grid
img(s, ss("2.26.31 PM"), Inches(0.15), Inches(0.82), Inches(6.5), Inches(3.2))
img(s, ss("2.26.49 PM"), Inches(6.75), Inches(0.82), Inches(6.4), Inches(3.2))
img(s, ss("2.26.58 PM"), Inches(0.15), Inches(4.1), Inches(6.5), Inches(3.0))
img(s, ss("2.27.24 PM"), Inches(6.75), Inches(4.1), Inches(6.4), Inches(3.0))

# Labels
for label, x, y in [
    ("Vendor Repository — 13 vendors, searchable catalog", Inches(0.15), Inches(0.82)),
    ("Data Upload — CSV/Excel, auto-detect, live refresh",  Inches(6.75), Inches(0.82)),
    ("Activity History — upload & download audit trail",    Inches(0.15), Inches(4.1)),
    ("User Management — role-based access control",         Inches(6.75), Inches(4.1)),
]:
    rect(s, x, y, Inches(6.45) if x < Inches(5) else Inches(6.4), Inches(0.3), KPMG_NAVY)
    txt(s, label, x + Inches(0.12), y + Inches(0.04), Inches(6.2), Inches(0.24),
        size=9, bold=True, color=WHITE)


# ════════════════════════════════════════════════════════════════════════════════
# SLIDE 9 — THANK YOU / NEXT STEPS
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, SLIDE_W, SLIDE_H, KPMG_NAVY)
rect(s, 0, 0, Inches(0.12), SLIDE_H, KPMG_LIGHT)
rect(s, Inches(9.8), 0, Inches(3.53), SLIDE_H, KPMG_MED)

# Right: app screenshot
img(s, ss("2.26.10 PM"), Inches(9.9), Inches(0.3), Inches(3.3), Inches(6.8))

txt(s, "KPMG", Inches(0.3), Inches(0.5), Inches(4), Inches(0.8),
    size=38, bold=True, color=WHITE)
rect(s, Inches(0.3), Inches(1.55), Inches(5.5), Inches(0.04), KPMG_GOLD)

txt(s, "Thank You", Inches(0.3), Inches(1.75), Inches(9.3), Inches(1.1),
    size=52, bold=True, color=WHITE)
txt(s, "IntelliSource — Procurement Intelligence, Powered by KPMG",
    Inches(0.3), Inches(2.85), Inches(9.2), Inches(0.5),
    size=16, color=KPMG_LIGHT)

rect(s, Inches(0.3), Inches(3.5), Inches(5.5), Inches(0.04), KPMG_LIGHT)

steps = [
    ("Week 1", "Data readiness — SAP export access"),
    ("Week 2", "Pilot upload — single company code"),
    ("Week 3", "Stakeholder walkthrough — live demo"),
    ("Week 4", "Go / No-Go — full deployment"),
]
cy = Inches(3.72)
for wk, desc in steps:
    rect(s, Inches(0.3), cy, Inches(1.1), Inches(0.42), KPMG_RED)
    txt(s, wk, Inches(0.3), cy + Inches(0.08), Inches(1.1), Inches(0.3),
        size=10, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    txt(s, desc, Inches(1.55), cy + Inches(0.08), Inches(7.5), Inches(0.3),
        size=11, color=RGBColor(0xC0, 0xD8, 0xFF))
    cy += Inches(0.56)

txt(s, "getdev24@gmail.com",
    Inches(0.3), Inches(6.05), Inches(8), Inches(0.35),
    size=12, color=KPMG_GOLD)

rect(s, 0, Inches(6.95), SLIDE_W, Inches(0.55), RGBColor(0x00, 0x28, 0x70))
txt(s, "KPMG India  |  Procurement Advisory  |  CONFIDENTIAL",
    Inches(0.3), Inches(7.02), Inches(12.5), Inches(0.35),
    size=10, color=WHITE)


# ── Save ───────────────────────────────────────────────────────────────────────
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "IntelliSource_Presentation.pptx")
prs.save(out)
print(f"Saved: {out}")
print(f"Slides: {len(prs.slides)}")
