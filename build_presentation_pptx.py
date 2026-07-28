"""IntelliSource_Presentation.pptx — 1 screenshot per slide, orange highlights, minimal text."""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

NAVY   = RGBColor(0x00, 0x33, 0x8D)
MED    = RGBColor(0x00, 0x5E, 0xB8)
LIGHT  = RGBColor(0x00, 0x91, 0xDA)
GOLD   = RGBColor(0x8F, 0x73, 0x26)
RED    = RGBColor(0xBC, 0x20, 0x4B)
ORANGE = RGBColor(0xFF, 0x72, 0x00)
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
DARK   = RGBColor(0x05, 0x18, 0x35)

W = Inches(13.33)
H = Inches(7.5)

SS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app_screenshots")
_NB = chr(0x202F)  # narrow no-break space macOS uses before AM/PM

def ss(t):
    return os.path.join(SS_DIR,
        f"Screenshot 2026-07-08 at {t}.png"
        .replace(" PM", f"{_NB}PM").replace(" AM", f"{_NB}AM"))

prs = Presentation()
prs.slide_width  = W
prs.slide_height = H
BLANK = prs.slide_layouts[6]


# ── primitives ─────────────────────────────────────────────────────────────────

def box(sl, x, y, w, h, fill):
    sh = sl.shapes.add_shape(1, x, y, w, h)
    sh.line.fill.background()
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    return sh

def t(sl, text, x, y, w, h, sz=11, bold=False, col=WHITE,
      align=PP_ALIGN.LEFT, italic=False):
    tb = sl.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = text
    r.font.size = Pt(sz)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = col
    r.font.name = "Calibri"

def pic(sl, path, x, y, w, h):
    if os.path.exists(path):
        sl.shapes.add_picture(path, x, y, w, h)

def header(sl, title, sub=None):
    """Slim KPMG top bar over screenshot."""
    box(sl, 0, 0, W, Inches(0.5), NAVY)
    box(sl, 0, 0, Inches(0.07), Inches(0.5), ORANGE)
    t(sl, "KPMG  IntelliSource", Inches(0.15), Inches(0.06),
      Inches(2.8), Inches(0.38), sz=11, bold=True, col=LIGHT)
    t(sl, title, Inches(3.1), Inches(0.06), Inches(7.5), Inches(0.38),
      sz=14, bold=True, col=WHITE, align=PP_ALIGN.CENTER)
    if sub:
        t(sl, sub, Inches(10.8), Inches(0.06), Inches(2.4), Inches(0.38),
          sz=9, col=RGBColor(0x88,0xAA,0xDD), align=PP_ALIGN.RIGHT)

def footer_bar(sl):
    box(sl, 0, Inches(7.18), W, Inches(0.32), NAVY)
    t(sl, "CONFIDENTIAL  |  KPMG India  |  Q2 FY2024",
      Inches(0.2), Inches(7.21), W - Inches(0.4), Inches(0.24),
      sz=7.5, col=RGBColor(0x88,0xAA,0xDD), align=PP_ALIGN.RIGHT)

def hi(sl, x, y, w, h, label=None, label_below=False):
    """Orange outline highlight box + optional label tag."""
    sh = sl.shapes.add_shape(1, x, y, w, h)
    sh.fill.background()
    sh.line.color.rgb = ORANGE
    sh.line.width = Pt(2.5)
    if label:
        lw = Inches(max(1.4, len(label) * 0.105 + 0.3))
        lh = Inches(0.27)
        if label_below:
            ly = y + h + Inches(0.04)
        else:
            ly = y - lh - Inches(0.04)
            if ly < Inches(0.52):
                ly = y + h + Inches(0.04)
        box(sl, x, ly, lw, lh, ORANGE)
        t(sl, f"  {label}", x, ly + Inches(0.02), lw, lh,
          sz=8.5, bold=True, col=WHITE)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 1 — TITLE
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
box(s, 0, 0, W, H, DARK)
box(s, 0, 0, Inches(0.1), H, ORANGE)
box(s, Inches(9.4), 0, Inches(3.93), H, NAVY)

pic(s, ss("2.21.57 PM"), Inches(9.5), Inches(0.1), Inches(3.73), Inches(7.3))

t(s, "KPMG", Inches(0.3), Inches(0.5), Inches(5), Inches(0.85),
  sz=40, bold=True, col=WHITE)
t(s, "India  |  Procurement Advisory",
  Inches(0.3), Inches(1.35), Inches(6), Inches(0.35),
  sz=13, col=LIGHT)

box(s, Inches(0.3), Inches(1.88), Inches(5.6), Inches(0.04), ORANGE)

t(s, "IntelliSource",
  Inches(0.3), Inches(2.05), Inches(9.0), Inches(1.2),
  sz=58, bold=True, col=WHITE)
t(s, "SAP Procurement Intelligence Platform",
  Inches(0.3), Inches(3.25), Inches(8.8), Inches(0.5),
  sz=19, col=LIGHT)

box(s, Inches(0.3), Inches(3.9), Inches(5.6), Inches(0.04), LIGHT)

stats = [
    "₹3,936 Cr  ·  Total Spend Visibility",
    "187         ·  SOD Conflicts Detected",
    "5            ·  Role-Specific Dashboards",
    "44.5 days ·  End-to-End P2P Cycle",
]
cy = Inches(4.1)
for s2 in stats:
    t(s, s2, Inches(0.3), cy, Inches(8.8), Inches(0.38),
      sz=13, col=RGBColor(0xAA,0xC8,0xFF))
    cy += Inches(0.46)

box(s, 0, Inches(6.95), W, Inches(0.55), MED)
t(s, "Application Demo  |  Q2 FY2024  |  All Companies",
  Inches(0.3), Inches(7.02), Inches(9), Inches(0.38), sz=10, col=WHITE)
t(s, "CONFIDENTIAL", Inches(11.0), Inches(7.02), Inches(2.2), Inches(0.38),
  sz=10, bold=True, col=GOLD, align=PP_ALIGN.RIGHT)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 2 — PROCUREMENT DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
# Screenshot 2940×1682. Full bleed → xscale=13.33/2940=0.004534, yscale=7.5/1682=0.004460
# KPI row 1: y_px≈158-315 → y_in=0.71–1.40, x_px≈195-2938 → x_in=0.88-13.32
# Cards are 4 wide → each ≈686px → 3.11 in
# Card 3 (High-Value POs): x_px=195+2*686=1567 → x_in=7.10
# Card 4 (Cycle Time):     x_px=195+3*686=2253 → x_in=10.21

s = prs.slides.add_slide(BLANK)
pic(s, ss("2.20.51 PM"), 0, 0, W, H)
header(s, "Procurement Dashboard", "Slide 1 of 2")
footer_bar(s)

hi(s, Inches(0.82), Inches(0.71), Inches(12.48), Inches(0.69),
   label="KPI Overview")
hi(s, Inches(6.98), Inches(0.71), Inches(3.11), Inches(0.69),
   label="85 High-Value POs  >₹1 Cr", label_below=True)
hi(s, Inches(0.82), Inches(1.47), Inches(6.25), Inches(0.58),
   label="Maverick Spend & Deletion Alerts", label_below=True)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 3 — FINANCIAL DASHBOARD  (KPI tiles)
# ══════════════════════════════════════════════════════════════════════════════
# Screenshot 2940×1682. KPI row y≈158-315
# 5 cards → each ≈549px → 2.49 in
# Card 2 (3-Way Match 84%): x=195+549=744 → x_in=3.37
# Card 3 (Invoice Days 40.5): x=195+2*549=1293 → x_in=5.86

s = prs.slides.add_slide(BLANK)
pic(s, ss("2.21.22 PM"), 0, 0, W, H)
header(s, "Financial Dashboard — KPIs", "Slide 1 of 2")
footer_bar(s)

hi(s, Inches(3.28), Inches(0.71), Inches(2.52), Inches(0.69),
   label="84%  3-Way Match  ← below 90% target")
hi(s, Inches(5.80), Inches(0.71), Inches(2.52), Inches(0.69),
   label="40.5 days  Avg Invoice Payment")
hi(s, Inches(0.82), Inches(0.71), Inches(2.46), Inches(0.69),
   label="₹958 Cr Payments YTD")


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 4 — FINANCIAL DASHBOARD  (charts continuation)
# ══════════════════════════════════════════════════════════════════════════════
# Screenshot 2940×1682. Shows Monthly Payments chart (left) + Payment Timing (right)
# Charts area: y≈320-1100px → y_in=1.43-4.91
# Monthly chart: x=180-1465px → x_in=0.82-6.64
# Payment timing (right): x=1480-2940px → x_in=6.71-13.33

s = prs.slides.add_slide(BLANK)
pic(s, ss("2.21.34 PM"), 0, 0, W, H)
header(s, "Financial Dashboard — Trends", "Slide 2 of 2")
footer_bar(s)

hi(s, Inches(0.82), Inches(1.5), Inches(5.82), Inches(3.7),
   label="Monthly Payments Trend  ₹ Cr")
hi(s, Inches(6.71), Inches(1.5), Inches(6.52), Inches(3.7),
   label="Payment Timing Distribution")


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 5 — LEADERSHIP DASHBOARD  (P2P pipeline + KPIs)
# ══════════════════════════════════════════════════════════════════════════════
# Screenshot 2940×1688
# P2P pipeline stages row: y≈58-220px → y_in=0.26-0.98
# KPI tiles row: y≈225-390px → y_in=1.00-1.74
# Risk panel (right): x≈1960-2938px, y≈225-1450px

s = prs.slides.add_slide(BLANK)
pic(s, ss("2.21.57 PM"), 0, 0, W, H)
header(s, "Leadership Dashboard", "Slide 1 of 2")
footer_bar(s)

# P2P pipeline highlight
hi(s, Inches(0.82), Inches(0.52), Inches(12.48), Inches(0.48),
   label="P2P Pipeline  132 PR → 163 PO → 117 GRN → 106 Inv → 82 Payment",
   label_below=True)
# SOD Conflicts KPI tile (2nd of 4 KPI cards)
hi(s, Inches(3.92), Inches(1.05), Inches(3.12), Inches(0.72),
   label="187 SOD Conflicts  ← click to drill down")
# Risk panel
hi(s, Inches(8.88), Inches(1.05), Inches(4.35), Inches(5.8),
   label="Risk Indicators Panel")


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 6 — LEADERSHIP DASHBOARD  (risk analytics continuation)
# ══════════════════════════════════════════════════════════════════════════════
# Screenshot 2940×1688. Shows CAPEX/OPEX ring + Monthly Spend Trend + Risk section
# Monthly Spend chart (left): x=180-1455px, y=310-870px → x_in=0.82-6.60, y_in=1.38-3.87
# CAPEX/OPEX ring (right): x=1470-2200px, y=310-870px → x_in=6.67-9.97
# Risk indicators (far right): x=2215-2938px, y=310-1450px → x_in=10.04-13.33

s = prs.slides.add_slide(BLANK)
pic(s, ss("2.22.42 PM"), 0, 0, W, H)
header(s, "Leadership — Risk Analytics", "Slide 2 of 2")
footer_bar(s)

hi(s, Inches(0.82), Inches(1.38), Inches(5.78), Inches(2.5),
   label="Monthly Spend Trend  ₹ Cr")
hi(s, Inches(6.67), Inches(1.38), Inches(3.30), Inches(2.5),
   label="CAPEX 48.3%  ·  OPEX 51.7%")
hi(s, Inches(10.04), Inches(0.52), Inches(3.28), Inches(6.5),
   label="Live Risk Indicators", label_below=False)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 7 — VENDOR PERFORMANCE DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
# Screenshot 2940×1682
# KPI row 1 (4 cards): y≈160-315px → y_in=0.71-1.40
#   Card 2 (Compliance 84.6%): x=195+686=881 → x_in=3.99, w=3.11
#   Card 4 (Avg Delay 5.1d): x=195+3*686=2253 → x_in=10.21
# KPI row 2 (3 cards): y≈328-455px → y_in=1.46-2.03
#   Card 1 (Blocked 2): x=195-881 → x_in=0.88-3.99

s = prs.slides.add_slide(BLANK)
pic(s, ss("2.24.04 PM"), 0, 0, W, H)
header(s, "Vendor Performance Dashboard", "Slide 1 of 2")
footer_bar(s)

hi(s, Inches(3.90), Inches(0.71), Inches(3.12), Inches(0.69),
   label="84.6% Compliance  ← below 90% target")
hi(s, Inches(0.82), Inches(1.46), Inches(3.12), Inches(0.57),
   label="2 Blocked Vendors  ← review required")
hi(s, Inches(10.12), Inches(0.71), Inches(3.12), Inches(0.69),
   label="5.1d Avg Delivery Delay")


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 8 — VENDOR PERFORMANCE  (charts continuation)
# ══════════════════════════════════════════════════════════════════════════════
# Screenshot 2940×1688
# Vendor Health Breakdown row: y≈115-230px → y_in=0.51-1.02
# Top-10 Vendors chart (left): x=180-1465px, y=520-820px → x_in=0.82-6.64, y_in=2.31-3.65
# Vendor Type Breakdown (right): x=1480-2940px, y=520-820px → x_in=6.71-13.33

s = prs.slides.add_slide(BLANK)
pic(s, ss("2.24.14 PM"), 0, 0, W, H)
header(s, "Vendor Performance — Charts", "Slide 2 of 2")
footer_bar(s)

hi(s, Inches(0.82), Inches(0.52), Inches(12.48), Inches(0.52),
   label="Vendor Health: 11 Active · 2 Non-Active · 10 Domestic · 2 MSME",
   label_below=True)
hi(s, Inches(0.82), Inches(2.2), Inches(5.82), Inches(3.5),
   label="Top-10 Vendors by Spend  ₹ Cr")
hi(s, Inches(6.71), Inches(2.2), Inches(6.52), Inches(3.5),
   label="Vendor Type Breakdown")


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 9 — UTILIZATION / CAPEX-OPEX DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
# Screenshot 2940×1680
# KPI row 1 (4 cards): y≈160-315px → y_in=0.71-1.40
#   Card 1 (CAPEX ₹1899): x=195-881 → x_in=0.88-3.99
#   Card 2 (OPEX ₹2036): x=881-1567 → x_in=3.99-7.10
# Monthly CAPEX vs OPEX chart (left): x=180-1450px, y=385-700px → x_in=0.82-6.57, y_in=1.72-3.12
# CAPEX vs OPEX split donut (right): x=1465-2938px, y=385-700px → x_in=6.64-13.32

s = prs.slides.add_slide(BLANK)
pic(s, ss("2.24.43 PM"), 0, 0, W, H)
header(s, "CAPEX / OPEX Dashboard", "Utilization")
footer_bar(s)

hi(s, Inches(0.82), Inches(0.71), Inches(3.11), Inches(0.69),
   label="CAPEX  ₹1,899.80 Cr  (48.3%)")
hi(s, Inches(3.93), Inches(0.71), Inches(3.12), Inches(0.69),
   label="OPEX  ₹2,036.54 Cr  (51.7%)")
hi(s, Inches(0.82), Inches(1.72), Inches(5.75), Inches(3.0),
   label="Monthly CAPEX vs OPEX Trend")
hi(s, Inches(6.64), Inches(1.72), Inches(6.68), Inches(3.0),
   label="Total Split  ₹3,936 Cr")


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 10 — P2P LIFECYCLE TRACKER
# ══════════════════════════════════════════════════════════════════════════════
# Screenshot 2940×1680
# P2P stage boxes row: y≈248-425px → y_in=1.10-1.89
#   7 boxes from x=195-1095px... wait they span full width
#   Actually from screenshot they span x=195-2935px (the full main area)
#   7 boxes each ≈ 392px → 1.78 in
#   Stage 5 (GRN 117 - yellow = slow): x=195+4*392=1763 → x_in=7.99
# Summary KPIs below stages: y≈455-560px → y_in=2.03-2.50
# Monthly P2P Funnel chart: y≈575-840px → y_in=2.56-3.74

s = prs.slides.add_slide(BLANK)
pic(s, ss("2.26.10 PM"), 0, 0, W, H)
header(s, "P2P Lifecycle Tracker", "End-to-End Procure-to-Pay")
footer_bar(s)

# Full stage funnel row
hi(s, Inches(0.82), Inches(1.10), Inches(12.48), Inches(0.79),
   label="PR 132 → PO Approved 158 → GRN 117 → Invoice 106 → Payment 82")
# GRN stage specifically (bottleneck indicator)
hi(s, Inches(7.99), Inches(1.10), Inches(1.78), Inches(0.79),
   label="GRN Bottleneck  33.9d  PO→GRN", label_below=True)
# Summary metrics bar
hi(s, Inches(0.82), Inches(2.07), Inches(12.48), Inches(0.44),
   label="Summary: 163 cases · 44.5d cycle · 31 Maverick POs", label_below=True)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 11 — DATA UPLOAD
# ══════════════════════════════════════════════════════════════════════════════
# Screenshot 2940×1684
# Upload drag-drop zone: x=240-1042px, y=245-428px → x_in=1.09-4.72, y_in=1.09-1.91
# Dataset Reference panel (right): x=1060-2930px, y=185-1550px → x_in=4.81-13.29

s = prs.slides.add_slide(BLANK)
pic(s, ss("2.26.49 PM"), 0, 0, W, H)
header(s, "Data Upload", "SAP CSV/Excel → IntelliSource → All Dashboards Live")
footer_bar(s)

hi(s, Inches(1.05), Inches(1.09), Inches(3.68), Inches(0.84),
   label="Drop CSV from SAP  ·  Auto-detected  ·  Max 50 MB")
hi(s, Inches(4.81), Inches(0.85), Inches(8.42), Inches(6.15),
   label="6 Dataset Types: PR · PO · Delivery · GRN · Invoice · Payment",
   label_below=True)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 12 — THANK YOU
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
box(s, 0, 0, W, H, DARK)
box(s, 0, 0, Inches(0.1), H, ORANGE)
box(s, Inches(9.5), 0, Inches(3.83), H, NAVY)
pic(s, ss("2.26.10 PM"), Inches(9.6), Inches(0.1), Inches(3.63), Inches(7.3))

t(s, "KPMG", Inches(0.3), Inches(0.55),
  Inches(5), Inches(0.85), sz=40, bold=True, col=WHITE)
t(s, "India  |  Procurement Advisory",
  Inches(0.3), Inches(1.38), Inches(6), Inches(0.35), sz=13, col=LIGHT)

box(s, Inches(0.3), Inches(1.88), Inches(5.6), Inches(0.04), ORANGE)

t(s, "Thank You", Inches(0.3), Inches(2.05), Inches(9.0), Inches(1.1),
  sz=52, bold=True, col=WHITE)
t(s, "IntelliSource  —  P2P Intelligence, Powered by KPMG",
  Inches(0.3), Inches(3.15), Inches(9.0), Inches(0.48), sz=16, col=LIGHT)

box(s, Inches(0.3), Inches(3.8), Inches(5.6), Inches(0.04), LIGHT)

nxt = [
    ("Week 1", "Data readiness check  —  SAP export access"),
    ("Week 2", "Pilot upload  —  single company code"),
    ("Week 3", "Stakeholder walkthrough  —  live demo"),
    ("Week 4", "Go / No-Go  —  full deployment"),
]
cy = Inches(4.0)
for wk, desc in nxt:
    box(s, Inches(0.3), cy, Inches(1.0), Inches(0.4), ORANGE)
    t(s, wk, Inches(0.3), cy + Inches(0.08), Inches(1.0), Inches(0.28),
      sz=10, bold=True, col=WHITE, align=PP_ALIGN.CENTER)
    t(s, desc, Inches(1.5), cy + Inches(0.08), Inches(7.7), Inches(0.28),
      sz=11, col=RGBColor(0xBB, 0xD4, 0xFF))
    cy += Inches(0.54)

t(s, "getdev24@gmail.com",
  Inches(0.3), Inches(6.2), Inches(6), Inches(0.35), sz=12, col=GOLD)

box(s, 0, Inches(6.95), W, Inches(0.55), MED)
t(s, "KPMG India  |  Procurement Advisory  |  CONFIDENTIAL",
  Inches(0.3), Inches(7.02), Inches(12.5), Inches(0.38), sz=10, col=WHITE)


# ── save ───────────────────────────────────────────────────────────────────────
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "IntelliSource_Presentation.pptx")
prs.save(out)
print(f"Saved  {out}")
print(f"Slides {len(prs.slides)}")
