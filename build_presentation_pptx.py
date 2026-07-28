"""IntelliSource_Presentation.pptx
Layout: 75% screenshot + 25% panel — alternating white/dark backgrounds,
alternating panel-left / panel-right positions. KPMG brand palette throughout.
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# ── KPMG Brand ─────────────────────────────────────────────────────────────────
NAVY   = RGBColor(0x00, 0x33, 0x8D)  # KPMG primary blue
MED    = RGBColor(0x00, 0x5E, 0xB8)  # medium blue
LIGHT  = RGBColor(0x00, 0x91, 0xDA)  # light blue
GOLD   = RGBColor(0x8F, 0x73, 0x26)  # KPMG gold
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
DARK   = RGBColor(0x05, 0x18, 0x35)  # near-black blue
MUTED  = RGBColor(0xBB, 0xD4, 0xFF)  # muted panel text
LGRAY  = RGBColor(0xF4, 0xF6, 0xFA)  # light gray for white slides

W      = Inches(13.33)
H      = Inches(7.5)
HDR    = Inches(0.48)           # header bar height
IMG_W  = Inches(10.0)           # 75% of 13.33 ≈ 10"
PNL_W  = W - IMG_W              # 25% ≈ 3.33"
BODY_H = H - HDR                # content height below header
PAD    = Inches(0.24)           # panel inner padding

SS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app_screenshots")
_NB    = chr(0x202F)            # macOS narrow no-break space before AM/PM

def ss(t):
    return os.path.join(SS_DIR,
        f"Screenshot 2026-07-08 at {t}.png"
        .replace(" PM", f"{_NB}PM").replace(" AM", f"{_NB}AM"))

prs = Presentation()
prs.slide_width  = W
prs.slide_height = H
BLANK = prs.slide_layouts[6]


# ── primitives ─────────────────────────────────────────────────────────────────

def rect(sl, x, y, w, h, color):
    sh = sl.shapes.add_shape(1, x, y, w, h)
    sh.line.fill.background()
    sh.fill.solid()
    sh.fill.fore_color.rgb = color
    return sh

def txt(sl, text, x, y, w, h, sz=11, bold=False, col=WHITE,
        align=PP_ALIGN.LEFT, italic=False):
    """Textbox supporting \\n line breaks as separate paragraphs."""
    tb = sl.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    for i, line in enumerate(text.split('\n')):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        r = p.add_run()
        r.text = line
        r.font.size  = Pt(sz)
        r.font.bold  = bold
        r.font.italic = italic
        r.font.color.rgb = col
        r.font.name  = "Calibri"

def pic(sl, path, x, y, w, h):
    if os.path.exists(path):
        sl.shapes.add_picture(path, x, y, w, h)

def _panel_body(sl, px, accent, title, cont, bullets):
    """Render panel text. px = panel left edge x."""
    TW = PNL_W - PAD * 2
    tx = px + PAD

    # Section title
    ty = HDR + Inches(0.3)
    txt(sl, title, tx, ty, TW, Inches(0.78), sz=15, bold=True, col=WHITE)

    # Thin accent divider
    div_y = ty + Inches(0.82)
    rect(sl, tx, div_y, TW, Inches(0.035), accent)

    # Continuation tag
    by = div_y + Inches(0.14)
    if cont:
        txt(sl, cont, tx, by, TW, Inches(0.28),
            sz=8.5, italic=True, col=accent)
        by += Inches(0.42)
    else:
        by += Inches(0.18)

    # Bullets
    for b in bullets:
        # dot
        rect(sl, tx, by + Inches(0.11), Inches(0.05), Inches(0.05), accent)
        txt(sl, b, tx + Inches(0.2), by, TW - Inches(0.2), Inches(0.78),
            sz=9.5, col=MUTED)
        by += Inches(0.85)


# ── slide templates ────────────────────────────────────────────────────────────

def slide_a(path, title, cont=None, bullets=[]):
    """TYPE A — white bg · image LEFT 75% · navy panel RIGHT 25% · blue accent."""
    s = prs.slides.add_slide(BLANK)

    # background
    rect(s, 0, 0, W, H, LGRAY)

    # panel (right 25%) — drawn before image so image is above bg
    rect(s, IMG_W, HDR, PNL_W, BODY_H, NAVY)
    rect(s, IMG_W, HDR, Inches(0.06), BODY_H, LIGHT)   # left accent stripe

    # screenshot (left 75%)
    pic(s, path, 0, HDR, IMG_W, BODY_H)

    # header bar — drawn last so it sits on top
    rect(s, 0, 0, W, HDR, NAVY)
    rect(s, 0, 0, Inches(0.07), HDR, LIGHT)
    txt(s, "KPMG  IntelliSource",
        Inches(0.16), Inches(0.08), Inches(3.5), HDR - Inches(0.08),
        sz=11, bold=True, col=LIGHT)

    # panel text (always on top)
    _panel_body(s, IMG_W, LIGHT, title, cont, bullets)
    return s


def slide_b(path, title, cont=None, bullets=[]):
    """TYPE B — dark bg · navy panel LEFT 25% · image RIGHT 75% · gold accent."""
    s = prs.slides.add_slide(BLANK)

    # background
    rect(s, 0, 0, W, H, DARK)

    # panel (left 25%)
    rect(s, 0, HDR, PNL_W, BODY_H, NAVY)
    rect(s, PNL_W - Inches(0.06), HDR, Inches(0.06), BODY_H, GOLD)  # right accent stripe

    # screenshot (right 75%)
    pic(s, path, PNL_W, HDR, IMG_W, BODY_H)

    # header bar
    rect(s, 0, 0, W, HDR, RGBColor(0x02, 0x10, 0x28))
    rect(s, 0, 0, Inches(0.07), HDR, GOLD)
    txt(s, "KPMG  IntelliSource",
        Inches(0.16), Inches(0.08), Inches(3.5), HDR - Inches(0.08),
        sz=11, bold=True, col=GOLD)

    # panel text
    _panel_body(s, 0, GOLD, title, cont, bullets)
    return s


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 1 — TITLE  (dark, full-bleed, no numbers)
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, W, H, DARK)
rect(s, 0, 0, Inches(0.1), H, LIGHT)
rect(s, Inches(9.5), 0, Inches(3.83), H, NAVY)
pic(s, ss("2.21.57 PM"), Inches(9.6), Inches(0.1), Inches(3.63), Inches(7.3))

txt(s, "KPMG",
    Inches(0.28), Inches(0.55), Inches(5), Inches(0.85),
    sz=40, bold=True, col=WHITE)
txt(s, "India  |  Procurement Advisory",
    Inches(0.28), Inches(1.4), Inches(6.5), Inches(0.35), sz=13, col=LIGHT)
rect(s, Inches(0.28), Inches(1.92), Inches(5.5), Inches(0.04), GOLD)

txt(s, "IntelliSource",
    Inches(0.28), Inches(2.1), Inches(9.1), Inches(1.15), sz=58, bold=True, col=WHITE)
txt(s, "Procurement Intelligence Platform",
    Inches(0.28), Inches(3.25), Inches(8.8), Inches(0.48), sz=20, col=LIGHT)
rect(s, Inches(0.28), Inches(3.9), Inches(5.5), Inches(0.04), LIGHT)

for i, line in enumerate([
    "Five role-specific dashboards",
    "Live data from your procurement system",
    "Risk detection invisible to standard reports",
    "End-to-end procure-to-pay pipeline view",
]):
    txt(s, f"   {line}", Inches(0.28), Inches(4.1 + i * 0.47),
        Inches(8.8), Inches(0.38), sz=13, col=MUTED)

rect(s, 0, Inches(7.02), W, Inches(0.48), MED)
txt(s, "Application Demo  |  Q2 FY2024",
    Inches(0.3), Inches(7.1), Inches(9), Inches(0.35), sz=10, col=WHITE)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 2 — PROCUREMENT   (Type A — white, panel right)
# ══════════════════════════════════════════════════════════════════════════════
slide_a(ss("2.20.51 PM"),
        "Procurement\nDashboard",
        bullets=[
            "Tracks every purchase order from creation through delivery",
            "Flags orders raised without an approved requisition",
            "Highlights high-value orders needing extra approval",
            "Monitors average time from request to order placement",
            "Alerts on orders marked for deletion",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 3 — FINANCIAL KPIs   (Type B — dark, panel left)
# ══════════════════════════════════════════════════════════════════════════════
slide_b(ss("2.21.22 PM"),
        "Financial\nDashboard",
        bullets=[
            "Monitors all outgoing vendor payments in real time",
            "Tracks whether invoices match goods received and the order",
            "Detects potential duplicate invoices before payment clears",
            "Shows average time from invoice posting to payment",
            "Segments spend as capital or operational automatically",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 4 — FINANCIAL CHARTS  (Type A — white, continuation)
# ══════════════════════════════════════════════════════════════════════════════
slide_a(ss("2.21.34 PM"),
        "Financial\nDashboard",
        cont="continued — Payment Trends",
        bullets=[
            "Monthly payment volume trend across the fiscal period",
            "Breaks down payments by timing: early, on time, and late",
            "Highlights irregular patterns in vendor payment activity",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 5 — LEADERSHIP   (Type B — dark, panel left)
# ══════════════════════════════════════════════════════════════════════════════
slide_b(ss("2.21.57 PM"),
        "Leadership\nDashboard",
        bullets=[
            "End-to-end view of the entire procurement pipeline",
            "Detects users who performed conflicting duties across documents",
            "Committed spend visible across all departments and entities",
            "Live risk indicators for executive and board-level review",
            "Maverick spend rate visible at a glance",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 6 — LEADERSHIP RISK  (Type A — white, continuation)
# ══════════════════════════════════════════════════════════════════════════════
slide_a(ss("2.22.42 PM"),
        "Leadership\nDashboard",
        cont="continued — Risk Analytics",
        bullets=[
            "Shows how budget splits between capital and operational spend",
            "Monthly spend trend for strategic planning and forecasting",
            "Risk indicators updated instantly on every data upload",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 7 — VENDOR PERFORMANCE  (Type B — dark, panel left)
# ══════════════════════════════════════════════════════════════════════════════
slide_b(ss("2.24.04 PM"),
        "Vendor\nPerformance",
        bullets=[
            "Identifies which vendors are active, blocked, or restricted",
            "Tracks compliance rating across all vendor relationships",
            "Monitors delivery lead time and delay patterns per vendor",
            "Flags vendors with purchasing or payment blocks immediately",
            "Surfaces changes to vendor master data this period",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 8 — VENDOR CHARTS  (Type A — white, continuation)
# ══════════════════════════════════════════════════════════════════════════════
slide_a(ss("2.24.14 PM"),
        "Vendor\nPerformance",
        cont="continued — Spend & Segmentation",
        bullets=[
            "Segments vendors as domestic, international, and one-time",
            "Shows which vendors account for the highest share of spend",
            "Delivery fill rate comparison across key suppliers",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 9 — CAPEX / OPEX  (Type B — dark, panel left)
# ══════════════════════════════════════════════════════════════════════════════
slide_b(ss("2.24.43 PM"),
        "CAPEX / OPEX\nDashboard",
        bullets=[
            "Automatically classifies each order as capital or operational",
            "Monthly trend shows how spend shifts between categories",
            "Tracks pending deliveries across both budget types",
            "Drill down by department to see where budget concentrates",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 10 — P2P LIFECYCLE  (Type A — white, panel right)
# ══════════════════════════════════════════════════════════════════════════════
slide_a(ss("2.26.10 PM"),
        "P2P Lifecycle\nTracker",
        bullets=[
            "Visualises every stage from purchase request to final payment",
            "Colour-coded health: on target, slow, or bottlenecked",
            "Shows how many transactions complete each stage",
            "Identifies where documents stall in the pipeline",
            "Tracks unauthorised orders and returns at each stage",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 11 — DATA UPLOAD  (Type B — dark, panel left)
# ══════════════════════════════════════════════════════════════════════════════
slide_b(ss("2.26.49 PM"),
        "Data Upload",
        bullets=[
            "Upload exported data files to refresh all dashboards at once",
            "System auto-detects the dataset type from column headers",
            "All metrics across every dashboard update within seconds",
            "Supports multiple file formats including Excel and CSV",
        ])


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 12 — THANK YOU  (dark, full-bleed)
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, W, H, DARK)
rect(s, 0, 0, Inches(0.1), H, LIGHT)
rect(s, Inches(9.5), 0, Inches(3.83), H, NAVY)
pic(s, ss("2.26.10 PM"), Inches(9.6), Inches(0.1), Inches(3.63), Inches(7.3))

txt(s, "KPMG",
    Inches(0.28), Inches(0.55), Inches(5), Inches(0.85), sz=40, bold=True, col=WHITE)
txt(s, "India  |  Procurement Advisory",
    Inches(0.28), Inches(1.4), Inches(6.5), Inches(0.35), sz=13, col=LIGHT)
rect(s, Inches(0.28), Inches(1.92), Inches(5.5), Inches(0.04), GOLD)

txt(s, "Thank You",
    Inches(0.28), Inches(2.1), Inches(9.1), Inches(1.05), sz=52, bold=True, col=WHITE)
txt(s, "Procurement Intelligence, Powered by KPMG",
    Inches(0.28), Inches(3.18), Inches(9.1), Inches(0.48), sz=16, col=LIGHT)
rect(s, Inches(0.28), Inches(3.82), Inches(5.5), Inches(0.04), LIGHT)

for i, (wk, desc) in enumerate([
    ("Week 1", "Data readiness check"),
    ("Week 2", "Pilot upload — single business unit"),
    ("Week 3", "Stakeholder walkthrough — live demo"),
    ("Week 4", "Go / No-Go — full rollout"),
]):
    cy = Inches(4.02 + i * 0.55)
    rect(s, Inches(0.28), cy, Inches(1.0), Inches(0.4), MED)
    txt(s, wk, Inches(0.28), cy + Inches(0.08), Inches(1.0), Inches(0.28),
        sz=10, bold=True, col=WHITE, align=PP_ALIGN.CENTER)
    txt(s, desc, Inches(1.45), cy + Inches(0.08), Inches(7.9), Inches(0.28),
        sz=11, col=MUTED)

txt(s, "getdev24@gmail.com",
    Inches(0.28), Inches(6.3), Inches(6), Inches(0.35), sz=12, col=GOLD)
rect(s, 0, Inches(7.02), W, Inches(0.48), MED)
txt(s, "KPMG India  |  Procurement Advisory",
    Inches(0.3), Inches(7.1), W - Inches(0.5), Inches(0.35), sz=10, col=WHITE)


# ── save ───────────────────────────────────────────────────────────────────────
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "IntelliSource_Presentation.pptx")
prs.save(out)
print(f"Saved  {out}")
print(f"Slides {len(prs.slides)}")
