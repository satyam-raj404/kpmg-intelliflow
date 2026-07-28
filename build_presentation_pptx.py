"""IntelliSource_Presentation.pptx — 1 screenshot per slide, 75/25 split, no numbers."""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

NAVY  = RGBColor(0x00, 0x33, 0x8D)
MED   = RGBColor(0x00, 0x5E, 0xB8)
LIGHT = RGBColor(0x00, 0x91, 0xDA)
GOLD  = RGBColor(0x8F, 0x73, 0x26)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
DARK  = RGBColor(0x05, 0x18, 0x35)
MUTED = RGBColor(0xBB, 0xD4, 0xFF)

W = Inches(13.33)
H = Inches(7.5)

SS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app_screenshots")
_NB = chr(0x202F)

def ss(t):
    return os.path.join(SS_DIR,
        f"Screenshot 2026-07-08 at {t}.png"
        .replace(" PM", f"{_NB}PM").replace(" AM", f"{_NB}AM"))

prs = Presentation()
prs.slide_width  = W
prs.slide_height = H
BLANK = prs.slide_layouts[6]


# ── primitives ─────────────────────────────────────────────────────────────────

def fill(sl, x, y, w, h, color):
    sh = sl.shapes.add_shape(1, x, y, w, h)
    sh.line.fill.background()
    sh.fill.solid()
    sh.fill.fore_color.rgb = color
    return sh

def label(sl, text, x, y, w, h, sz=11, bold=False, col=WHITE,
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

def show(sl, path, x, y, w, h):
    if os.path.exists(path):
        sl.shapes.add_picture(path, x, y, w, h)

def slide(path, title, cont_label=None, bullets=[]):
    """Standard content slide: 75% image left, 25% dark panel right."""
    s = prs.slides.add_slide(BLANK)

    HDR = Inches(0.48)
    IMG_W = Inches(10.0)   # 75% of 13.33
    PNL_X = IMG_W
    PNL_W = W - IMG_W      # 25%
    BODY_H = H - HDR

    # ── header ──
    fill(s, 0, 0, W, HDR, NAVY)
    fill(s, 0, 0, Inches(0.07), HDR, LIGHT)
    label(s, "KPMG  IntelliSource",
          Inches(0.15), Inches(0.07), Inches(3.2), HDR - Inches(0.06),
          sz=11, bold=True, col=LIGHT)

    # ── screenshot ──
    show(s, path, 0, HDR, IMG_W, BODY_H)

    # ── right panel ──
    fill(s, PNL_X, HDR, PNL_W, BODY_H, DARK)
    fill(s, PNL_X, HDR, Inches(0.05), BODY_H, LIGHT)  # left accent

    # section title
    label(s, title,
          PNL_X + Inches(0.2), HDR + Inches(0.22),
          PNL_W - Inches(0.25), Inches(0.65),
          sz=15, bold=True, col=WHITE)

    # continuation tag
    if cont_label:
        fill(s, PNL_X + Inches(0.2), HDR + Inches(0.95),
             PNL_W - Inches(0.4), Inches(0.26), MED)
        label(s, f"  {cont_label}",
              PNL_X + Inches(0.2), HDR + Inches(0.97),
              PNL_W - Inches(0.4), Inches(0.24),
              sz=8, bold=True, col=WHITE)

    # bullet points
    by = HDR + (Inches(1.35) if cont_label else Inches(1.05))
    for b in bullets:
        fill(s, PNL_X + Inches(0.22), by + Inches(0.08),
             Inches(0.06), Inches(0.06), LIGHT)
        label(s, b,
              PNL_X + Inches(0.38), by,
              PNL_W - Inches(0.5), Inches(0.75),
              sz=10, col=MUTED)
        by += Inches(0.88)

    return s


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 1 — TITLE
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
fill(s, 0, 0, W, H, DARK)
fill(s, 0, 0, Inches(0.1), H, LIGHT)
fill(s, Inches(9.5), 0, Inches(3.83), H, NAVY)
show(s, ss("2.21.57 PM"), Inches(9.6), Inches(0.1), Inches(3.63), Inches(7.3))

label(s, "KPMG", Inches(0.3), Inches(0.6),
      Inches(5), Inches(0.85), sz=40, bold=True, col=WHITE)
label(s, "India  |  Procurement Advisory",
      Inches(0.3), Inches(1.42), Inches(6), Inches(0.35), sz=13, col=LIGHT)

fill(s, Inches(0.3), Inches(1.95), Inches(5.6), Inches(0.04), GOLD)

label(s, "IntelliSource",
      Inches(0.3), Inches(2.1), Inches(9.0), Inches(1.15),
      sz=58, bold=True, col=WHITE)
label(s, "Procurement Intelligence Platform",
      Inches(0.3), Inches(3.25), Inches(8.8), Inches(0.5),
      sz=20, col=LIGHT)

fill(s, Inches(0.3), Inches(3.9), Inches(5.6), Inches(0.04), LIGHT)

title_lines = [
    "Five role-specific dashboards",
    "Live data from your procurement system",
    "Detects risks invisible to standard reporting",
    "End-to-end procure-to-pay visibility",
]
for i, line in enumerate(title_lines):
    label(s, f"   {line}", Inches(0.3), Inches(4.1 + i * 0.46),
          Inches(8.8), Inches(0.38), sz=13, col=RGBColor(0xAA, 0xC8, 0xFF))

fill(s, 0, Inches(7.0), W, Inches(0.5), MED)
label(s, "Application Demo  |  Q2 FY2024",
      Inches(0.3), Inches(7.06), Inches(9), Inches(0.38), sz=10, col=WHITE)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 2 — PROCUREMENT DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
slide(ss("2.20.51 PM"),
      "Procurement\nDashboard",
      bullets=[
          "Tracks every purchase order from creation through delivery",
          "Flags orders raised without an approved requisition",
          "Highlights high-value orders needing additional approval",
          "Monitors average time from request to order placement",
          "Alerts on orders marked for deletion",
      ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 3 — FINANCIAL DASHBOARD  (KPIs)
# ══════════════════════════════════════════════════════════════════════════════
slide(ss("2.21.22 PM"),
      "Financial\nDashboard",
      bullets=[
          "Monitors all outgoing vendor payments in real time",
          "Tracks whether invoices match goods received and the order",
          "Detects potential duplicate invoices before payment clears",
          "Shows average time from invoice posting to payment",
          "Segments spend as capital or operational automatically",
      ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 4 — FINANCIAL DASHBOARD  (charts — continuation)
# ══════════════════════════════════════════════════════════════════════════════
slide(ss("2.21.34 PM"),
      "Financial\nDashboard",
      cont_label="continued — Payment Trends",
      bullets=[
          "Monthly payment volume trend across the fiscal period",
          "Breaks down payments by timing: early, on time, and late",
          "Identifies periods of concentrated or irregular payment activity",
      ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 5 — LEADERSHIP DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
slide(ss("2.21.57 PM"),
      "Leadership\nDashboard",
      bullets=[
          "End-to-end view of the entire procurement pipeline",
          "Detects users who performed conflicting duties across documents",
          "Total committed spend across all departments and entities",
          "Live risk indicators for executive and board-level review",
          "Maverick spend rate visible at a glance",
      ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 6 — LEADERSHIP DASHBOARD  (risk analytics — continuation)
# ══════════════════════════════════════════════════════════════════════════════
slide(ss("2.22.42 PM"),
      "Leadership\nDashboard",
      cont_label="continued — Risk Analytics",
      bullets=[
          "Shows how budget splits between capital and operational spend",
          "Monthly spend trend for strategic planning and forecasting",
          "Risk indicators updated instantly on every data upload",
      ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 7 — VENDOR PERFORMANCE DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
slide(ss("2.24.04 PM"),
      "Vendor\nPerformance",
      bullets=[
          "Identifies which vendors are active, blocked, or restricted",
          "Tracks compliance rating across all vendor relationships",
          "Monitors delivery lead time and delay patterns per vendor",
          "Flags vendors with purchasing or payment blocks immediately",
          "Surfaces changes to vendor master data this period",
      ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 8 — VENDOR PERFORMANCE  (charts — continuation)
# ══════════════════════════════════════════════════════════════════════════════
slide(ss("2.24.14 PM"),
      "Vendor\nPerformance",
      cont_label="continued — Spend & Segmentation",
      bullets=[
          "Segments vendors as domestic, international, and one-time",
          "Shows which vendors account for the highest share of spend",
          "Delivery fill rate comparison across key suppliers",
      ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 9 — UTILIZATION / CAPEX-OPEX DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
slide(ss("2.24.43 PM"),
      "CAPEX / OPEX\nDashboard",
      bullets=[
          "Automatically classifies each order as capital or operational",
          "Monthly trend shows how spend shifts between categories",
          "Tracks pending deliveries for both capital and operational orders",
          "Drill down by department to see where budget is concentrated",
      ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 10 — P2P LIFECYCLE TRACKER
# ══════════════════════════════════════════════════════════════════════════════
slide(ss("2.26.10 PM"),
      "P2P Lifecycle\nTracker",
      bullets=[
          "Visualises every stage from purchase request to final payment",
          "Colour-coded health: on target, slow, or bottlenecked",
          "Shows how many transactions complete each stage",
          "Identifies where documents are delayed in the pipeline",
          "Tracks maverick orders and returns at each stage",
      ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 11 — DATA UPLOAD
# ══════════════════════════════════════════════════════════════════════════════
slide(ss("2.26.49 PM"),
      "Data Upload",
      bullets=[
          "Upload exported data files to refresh all dashboards at once",
          "System auto-detects the dataset type from column headers",
          "All metrics across every dashboard update within seconds",
          "Supports multiple file formats including Excel and CSV",
      ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 12 — THANK YOU
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
fill(s, 0, 0, W, H, DARK)
fill(s, 0, 0, Inches(0.1), H, LIGHT)
fill(s, Inches(9.5), 0, Inches(3.83), H, NAVY)
show(s, ss("2.26.10 PM"), Inches(9.6), Inches(0.1), Inches(3.63), Inches(7.3))

label(s, "KPMG", Inches(0.3), Inches(0.6),
      Inches(5), Inches(0.85), sz=40, bold=True, col=WHITE)
label(s, "India  |  Procurement Advisory",
      Inches(0.3), Inches(1.42), Inches(6), Inches(0.35), sz=13, col=LIGHT)

fill(s, Inches(0.3), Inches(1.95), Inches(5.6), Inches(0.04), GOLD)

label(s, "Thank You",
      Inches(0.3), Inches(2.1), Inches(9.0), Inches(1.1),
      sz=52, bold=True, col=WHITE)
label(s, "IntelliSource  —  Procurement Intelligence, Powered by KPMG",
      Inches(0.3), Inches(3.2), Inches(9.0), Inches(0.48), sz=15, col=LIGHT)

fill(s, Inches(0.3), Inches(3.85), Inches(5.6), Inches(0.04), LIGHT)

for i, (wk, desc) in enumerate([
    ("Week 1", "Data readiness check"),
    ("Week 2", "Pilot upload — single business unit"),
    ("Week 3", "Stakeholder walkthrough"),
    ("Week 4", "Go / No-Go — full rollout"),
]):
    cy = Inches(4.05 + i * 0.54)
    fill(s, Inches(0.3), cy, Inches(1.0), Inches(0.4), MED)
    label(s, wk, Inches(0.3), cy + Inches(0.08),
          Inches(1.0), Inches(0.28), sz=10, bold=True, col=WHITE, align=PP_ALIGN.CENTER)
    label(s, desc, Inches(1.48), cy + Inches(0.08),
          Inches(7.8), Inches(0.28), sz=11, col=RGBColor(0xBB, 0xD4, 0xFF))

label(s, "getdev24@gmail.com",
      Inches(0.3), Inches(6.3), Inches(6), Inches(0.35), sz=12, col=GOLD)

fill(s, 0, Inches(7.0), W, Inches(0.5), MED)
label(s, "KPMG India  |  Procurement Advisory",
      Inches(0.3), Inches(7.07), Inches(12.5), Inches(0.38), sz=10, col=WHITE)


# ── save ───────────────────────────────────────────────────────────────────────
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "IntelliSource_Presentation.pptx")
prs.save(out)
print(f"Saved  {out}")
print(f"Slides {len(prs.slides)}")
