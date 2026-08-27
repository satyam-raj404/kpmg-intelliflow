"""Build IntelliSource_AI_Roadmap.pptx — KPMG branded deck presenting the
proposed AI feature catalog (A/B/C/D) and phased roadmap for IntelliSource.
Primitives reused/merged from build_pitch_pptx.py + build_presentation_pptx.py.
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# ── KPMG Brand Palette ────────────────────────────────────────────────────────
NAVY   = RGBColor(0x00, 0x33, 0x8D)
MED    = RGBColor(0x00, 0x5E, 0xB8)
LIGHT  = RGBColor(0x00, 0x91, 0xDA)
TEAL   = RGBColor(0x00, 0x99, 0xA8)
GOLD   = RGBColor(0x8F, 0x73, 0x26)
RED    = RGBColor(0xBC, 0x20, 0x4B)
GRAY   = RGBColor(0x63, 0x66, 0x6A)
LTGRAY = RGBColor(0xF2, 0xF2, 0xF2)
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
BLACK  = RGBColor(0x1A, 0x1A, 0x1A)
DARK   = RGBColor(0x05, 0x18, 0x35)
DARKCARD = RGBColor(0x0A, 0x24, 0x50)
MUTED  = RGBColor(0xBB, 0xD4, 0xFF)
GREEN_OK = RGBColor(0x00, 0x7A, 0x33)
ORANGE_WARN = RGBColor(0xFF, 0x6B, 0x00)

W = Inches(13.33)
H = Inches(7.5)

prs = Presentation()
prs.slide_width  = W
prs.slide_height = H
BLANK = prs.slide_layouts[6]


# ── primitives ─────────────────────────────────────────────────────────────────

def add_rect(slide, x, y, w, h, fill_rgb):
    shape = slide.shapes.add_shape(1, x, y, w, h)
    shape.line.fill.background()
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_rgb
    return shape


def add_text(slide, text, x, y, w, h, size=18, bold=False, color=WHITE,
             align=PP_ALIGN.LEFT, wrap=True, italic=False):
    """Textbox supporting \\n line breaks as separate paragraphs."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = wrap
    for i, line in enumerate(text.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        r = p.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.italic = italic
        r.font.color.rgb = color
        r.font.name = "Calibri"
    return tb


def kpmg_header(slide, title, subtitle=None, dark=True):
    bg = NAVY if dark else LTGRAY
    add_rect(slide, 0, 0, W, Inches(1.15), bg)
    add_rect(slide, 0, 0, Inches(0.08), Inches(1.15), LIGHT)
    add_text(slide, title, Inches(0.2), Inches(0.12), Inches(11.5), Inches(0.6),
              size=28, bold=True, color=WHITE if dark else NAVY, align=PP_ALIGN.LEFT)
    if subtitle:
        add_text(slide, subtitle, Inches(0.2), Inches(0.72), Inches(11.5), Inches(0.35),
                  size=13, color=LIGHT if dark else GRAY, align=PP_ALIGN.LEFT)


def kpmg_footer(slide, text="KPMG India — IntelliSource | AI Strategy Briefing"):
    add_rect(slide, 0, Inches(7.1), W, Inches(0.4), NAVY)
    add_text(slide, text, Inches(0.2), Inches(7.12), Inches(10), Inches(0.3),
              size=8, color=RGBColor(0xB0, 0xC4, 0xDE), align=PP_ALIGN.LEFT)
    add_text(slide, "CONFIDENTIAL", Inches(11.5), Inches(7.12), Inches(1.6), Inches(0.3),
              size=8, bold=True, color=GOLD, align=PP_ALIGN.RIGHT)


def divider(slide, y, color=LIGHT):
    add_rect(slide, Inches(0.2), y, Inches(12.9), Inches(0.03), color)


def pill(slide, text, x, y, w, h, bg, fg=WHITE, size=10, bold=True):
    add_rect(slide, x, y, w, h, bg)
    add_text(slide, text, x, y, w, h, size=size, bold=bold, color=fg, align=PP_ALIGN.CENTER)


def feature_card(slide, x, y, w, h, tag, title, body, accent, dark_bg=False):
    bg = DARKCARD if dark_bg else LTGRAY
    title_col = WHITE if dark_bg else NAVY
    body_col = MUTED if dark_bg else GRAY
    add_rect(slide, x, y, w, h, bg)
    add_rect(slide, x, y, w, Inches(0.08), accent)
    tag_w = Inches(0.62)
    pill(slide, tag, x + w - tag_w - Inches(0.14), y + Inches(0.16), tag_w, Inches(0.32), accent)
    add_text(slide, title, x + Inches(0.16), y + Inches(0.16), w - tag_w - Inches(0.32), Inches(0.68),
              size=13.5, bold=True, color=title_col, wrap=True)
    add_text(slide, body, x + Inches(0.16), y + Inches(0.86), w - Inches(0.32), h - Inches(1.0),
              size=10, color=body_col, wrap=True)


def card_row(slide, cards, y, h, dark_bg=False):
    n = len(cards)
    gap = Inches(0.15)
    cw = (W - Inches(0.4) - gap * (n - 1)) / n
    cx = Inches(0.2)
    for tag, title, body, accent in cards:
        feature_card(slide, cx, y, cw, h, tag, title, body, accent, dark_bg=dark_bg)
        cx += cw + gap


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 1 — TITLE  (dark, no numbers)
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, W, H, NAVY)
add_rect(s, 0, 0, Inches(0.12), H, LIGHT)
add_rect(s, Inches(10.5), 0, Inches(2.83), Inches(2.5), MED)
add_rect(s, Inches(11.5), 0, Inches(1.83), Inches(1.5), LIGHT)

add_text(s, "KPMG", Inches(0.3), Inches(0.3), Inches(3), Inches(0.7),
          size=36, bold=True, color=WHITE)
add_text(s, "India", Inches(0.3), Inches(0.95), Inches(3), Inches(0.4),
          size=16, color=LIGHT)
divider(s, Inches(1.5), LIGHT)

add_text(s, "AI Roadmap", Inches(0.3), Inches(1.75), Inches(11), Inches(1.1),
          size=52, bold=True, color=WHITE)
add_text(s, "IntelliSource — From Descriptive to Predictive & Prescriptive Intelligence",
          Inches(0.3), Inches(2.85), Inches(11.5), Inches(0.6), size=19, color=LIGHT)
divider(s, Inches(3.6), GOLD)

for i, line in enumerate([
    "Generative insight on every anomaly, not just a flag",
    "Explainable risk scoring for vendors and payments",
    "Predictive ML as transaction volume scales",
    "Document & semantic AI for contracts and invoices",
]):
    add_text(s, f"   {line}", Inches(0.3), Inches(3.8 + i * 0.47),
              Inches(9.5), Inches(0.38), size=13, color=MUTED)

add_rect(s, 0, Inches(6.9), W, Inches(0.6), MED)
add_text(s, "KPMG India  |  Procurement Advisory  |  AI Strategy Briefing",
          Inches(0.3), Inches(6.95), Inches(10.5), Inches(0.45), size=11, color=WHITE)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 2 — WHERE VALUE LEAKS TODAY  (white)
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, W, H, WHITE)
kpmg_header(s, "Where P2P Value Leaks", "The Gap the AI Roadmap Is Built to Close", dark=False)
kpmg_footer(s)

leaks = [
    ("Maverick Spend", "5–15% of addressable spend bypasses contracts and negotiated pricing.", RED),
    ("Duplicate & Erroneous Payments", "0.1–2% of AP value paid twice, or incorrectly, before anyone notices.", ORANGE_WARN),
    ("Price Variance", "PO price drifts from contract price, line by line, invisible in bulk.", GOLD),
    ("Lost Early-Pay Discounts", "Cash sits idle while early-payment terms quietly expire unused.", TEAL),
    ("MSME Late-Payment Penalties", "Statutory penalties accrue on invoices paid past the compliance window.", MED),
    ("SOD & Fraud Gaps", "Same user creates and approves — control gaps invisible to standard reports.", GRAY),
]
cw, ch, gap = Inches(4.17), Inches(2.55), Inches(0.15)
for i, (title, body, color) in enumerate(leaks):
    row, col = divmod(i, 3)
    x = Inches(0.2) + col * (cw + gap)
    y = Inches(1.35) + row * (ch + gap)
    add_rect(s, x, y, cw, ch, LTGRAY)
    add_rect(s, x, y, cw, Inches(0.08), color)
    add_text(s, title, x + Inches(0.15), y + Inches(0.18), cw - Inches(0.3), Inches(0.6),
              size=13.5, bold=True, color=color, wrap=True)
    add_text(s, body, x + Inches(0.15), y + Inches(0.85), cw - Inches(0.3), ch - Inches(1.0),
              size=10.5, color=GRAY, wrap=True)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 3 — TODAY vs THE GAP  (2x2 quadrant, white)
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, W, H, WHITE)
kpmg_header(s, "From Descriptive to Predictive", "IntelliSource Today Covers One Quadrant of Four", dark=False)
kpmg_footer(s)

quad_w, quad_h = Inches(6.35), Inches(2.75)
gap = Inches(0.2)
qx0, qy0 = Inches(0.2), Inches(1.35)

quads = [
    ("LIVE TODAY", GREEN_OK, "DESCRIPTIVE", "What happened",
     "5 role-specific dashboards + Ask IntelliSource narrate history and answer questions on demand.", NAVY),
    ("PHASE 1", GOLD, "GENERATIVE", "Explain & automate",
     "Ask IntelliSource already exists; anomaly-explanation and auto-briefings extend it further.", MED),
    ("PHASE 1", GOLD, "PRESCRIPTIVE", "What to do about it",
     "Vendor risk scoring and payment-timing optimization recommend the next action, not just a number.", LIGHT),
    ("PHASE 2", TEAL, "PREDICTIVE", "What will happen",
     "Late-delivery risk, cash-flow forecast, and maverick-spend prediction — built as data volume grows.", TEAL),
]
for i, (tag, tagcolor, label, sub, body, bg) in enumerate(quads):
    row, col = divmod(i, 2)
    x = qx0 + col * (quad_w + gap)
    y = qy0 + row * (quad_h + gap)
    add_rect(s, x, y, quad_w, quad_h, bg)
    pill(s, tag, x + quad_w - Inches(1.3), y + Inches(0.16), Inches(1.15), Inches(0.32), tagcolor)
    add_text(s, label, x + Inches(0.2), y + Inches(0.16), quad_w - Inches(1.6), Inches(0.45),
              size=18, bold=True, color=WHITE)
    add_text(s, sub, x + Inches(0.2), y + Inches(0.62), quad_w - Inches(0.4), Inches(0.35),
              size=12, italic=True, color=MUTED)
    add_text(s, body, x + Inches(0.2), y + Inches(1.05), quad_w - Inches(0.4), quad_h - Inches(1.2),
              size=11, color=WHITE, wrap=True)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 4 — CATALOG A: GENERATIVE / LLM  (white, Phase 1)
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, W, H, WHITE)
kpmg_header(s, "A.  Generative AI — Extend the Harness", "Fastest to ship — reuses Ask IntelliSource today", dark=False)
kpmg_footer(s)
pill(s, "PHASE 1", Inches(11.6), Inches(0.38), Inches(1.5), Inches(0.4), GOLD, size=12)

card_row(s, [
    ("A1", "Anomaly Explanation + Remediation",
     "Per flagged PO, the LLM explains why it's risky and recommends the action: block, escalate, or request a credit memo. Turns a reactive flag into a next-best-action.",
     NAVY),
    ("A2", "Auto Executive Briefings",
     "Scheduled \"Monthly P2P Health\" narrative + PDF — generated and delivered, so no one has to ask for it.",
     MED),
    ("A3", "Proactive Insight Agent",
     "On every data upload, surface the top things to look at — unprompted. Shifts the product from pull to push.",
     LIGHT),
], y=Inches(1.5), h=Inches(5.4))


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 5 — CATALOG B: EXPLAINABLE SCORING  (dark, Phase 1)
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, W, H, DARK)
kpmg_header(s, "B.  Explainable Scoring", "Deterministic core + LLM narrative — works on small data")
kpmg_footer(s)
pill(s, "PHASE 1", Inches(11.6), Inches(0.38), Inches(1.5), Inches(0.4), GOLD, size=12)

card_row(s, [
    ("B1", "Vendor Risk Score",
     "Composite 0–100 score — delivery reliability, price volatility, SOD/compliance hits, spend concentration — with an LLM \"why\" behind every score.",
     GOLD),
    ("B2", "Payment Timing Optimizer",
     "Per open invoice: capture the early-pay discount, preserve cash, or avoid an MSME late-payment penalty.",
     TEAL),
    ("B3", "Price-Variance Intelligence",
     "Flags and quantifies leakage vs. contract or PO price automatically — recovers what bulk review misses.",
     MED),
], y=Inches(1.5), h=Inches(5.4), dark_bg=True)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 6 — CATALOG C: PREDICTIVE ML  (white, Phase 2)
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, W, H, WHITE)
kpmg_header(s, "C.  Predictive ML", "Build as transaction volume grows", dark=False)
kpmg_footer(s)
pill(s, "PHASE 2", Inches(11.6), Inches(0.38), Inches(1.5), Inches(0.4), TEAL, size=12)

card_row(s, [
    ("C1", "Late-Delivery Risk",
     "Predicts on-time probability per PO from vendor history and lead time — expedite before it's late.",
     NAVY),
    ("C2", "Cash-Flow Forecast",
     "Projects AP outflow and predicts when each open invoice actually clears — direct input to CFO cash planning.",
     MED),
    ("C3", "Maverick-Spend Prediction",
     "Flags requisitions likely to go off-contract so procurement can intervene before the PO is cut.",
     LIGHT),
    ("C4", "PR→PO Bottleneck Prediction",
     "Flags requisitions that will stall in approval — cuts cycle time instead of just reporting it.",
     TEAL),
], y=Inches(1.5), h=Inches(5.4))


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 7 — CATALOG D: SEMANTIC / DOCUMENT AI  (dark, Phase 3)
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, W, H, DARK)
kpmg_header(s, "D.  Semantic & Document AI", "Bigger lift — highest long-term transformation")
kpmg_footer(s)
pill(s, "PHASE 3", Inches(11.6), Inches(0.38), Inches(1.5), Inches(0.4), RED, size=12)

card_row(s, [
    ("D1", "Vendor / Material Dedup",
     "Embeddings catch near-duplicate vendor and material records (\"Infosys Ltd\" vs \"Infosys Limited\") — clean master data.",
     GOLD),
    ("D2", "Contract Clause Intelligence",
     "Extracts terms from contract PDFs, matches against PO terms, flags deviations — extends the Contract Center.",
     MED),
    ("D3", "Invoice / PO Ingestion",
     "OCR + LLM extract from supplier PDFs and emails and auto-populate — kills manual data entry.",
     TEAL),
    ("D4", "Fuzzy Duplicate-Payment Detection",
     "Similarity matching beyond exact-match rules — catches near-duplicate vendor + amount + date combinations rules miss.",
     LIGHT),
], y=Inches(1.5), h=Inches(5.4), dark_bg=True)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 8 — PRIORITIZED ROADMAP  (white)
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, W, H, WHITE)
kpmg_header(s, "Prioritized Roadmap", "Three Phases, Increasing Model Complexity", dark=False)
kpmg_footer(s)

phases = [
    ("PHASE 1", GOLD, "Generative Wins", "Weeks, not months",
     ["A1", "A3", "B1", "B2"],
     "Reuses the harness and existing data end to end. No model training. Immediate demo value — prescriptive from day one."),
    ("PHASE 2", TEAL, "Predictive Core", "First real ML",
     ["C1", "C2", "D4"],
     "Needs a new predictions table and an offline training job. Confidence-scored, advisory outputs only."),
    ("PHASE 3", RED, "Automation + Documents", "Biggest lift",
     ["A2", "D2", "D3", "C3", "C4"],
     "Scheduled briefings, contract intelligence, invoice ingestion, upstream prediction — highest transformation."),
]
py = Inches(1.4)
ph = Inches(1.78)
for tag, color, title, sub, tags, body in phases:
    add_rect(s, Inches(0.2), py, Inches(12.93), ph, LTGRAY)
    add_rect(s, Inches(0.2), py, Inches(0.1), ph, color)
    pill(s, tag, Inches(0.45), py + Inches(0.18), Inches(1.3), Inches(0.4), color, size=12)
    add_text(s, title, Inches(1.95), py + Inches(0.16), Inches(4.5), Inches(0.42),
              size=16, bold=True, color=NAVY)
    add_text(s, sub, Inches(1.95), py + Inches(0.6), Inches(4.5), Inches(0.32),
              size=10.5, italic=True, color=color)
    tx = Inches(1.95)
    for t in tags:
        tw = Inches(0.55)
        pill(s, t, tx, py + Inches(1.0), tw, Inches(0.34), NAVY, size=10)
        tx += tw + Inches(0.1)
    add_text(s, body, Inches(6.6), py + Inches(0.2), Inches(6.35), ph - Inches(0.4),
              size=10.5, color=GRAY, wrap=True)
    py += ph + Inches(0.12)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 9 — ARCHITECTURE FIT + RECOMMENDATION  (dark)
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, W, H, NAVY)
kpmg_header(s, "Architecture Fit", "Reuses Everything Already Built")
kpmg_footer(s)

points = [
    ("Read-only tools, same endpoints",
     "New predictive tools register as harness READ-ONLY tools — explain_anomaly, score_vendor_risk, optimize_payment_timing, forecast_cashflow. The same endpoints power both Ask IntelliSource and dashboard widgets."),
    ("Advisory predictions table",
     "A new services/ml/ layer writes confidence-scored, timestamped predictions to a dedicated predictions table — never back to source P2P tables. The read-only invariant holds unchanged."),
    ("Confidence + provenance, human-in-loop",
     "Every AI output carries confidence and provenance and stays advisory — the Responsible-AI posture already documented in the AI ARB. Nothing auto-executes."),
]
py = Inches(1.45)
for title, body in points:
    add_rect(s, Inches(0.2), py, Inches(0.09), Inches(1.15), LIGHT)
    add_text(s, title, Inches(0.5), py, Inches(12.2), Inches(0.4), size=15, bold=True, color=WHITE)
    add_text(s, body, Inches(0.5), py + Inches(0.42), Inches(12.2), Inches(0.7), size=11.5, color=MUTED, wrap=True)
    py += Inches(1.35)

add_rect(s, Inches(0.2), Inches(5.9), Inches(12.93), Inches(0.95), GOLD)
add_text(s,
    "Recommended starting point: A1 Anomaly Explanation + B1 Vendor Risk Score — zero ML training, "
    "runs on today's data, the largest perceived-intelligence jump for the least engineering.",
    Inches(0.4), Inches(6.02), Inches(12.5), Inches(0.7), size=13, bold=True, color=WHITE, wrap=True)


# ══════════════════════════════════════════════════════════════════════════════
# SLIDE 10 — THANK YOU  (dark, full-bleed)
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
add_rect(s, 0, 0, W, H, DARK)
add_rect(s, 0, 0, Inches(0.1), H, LIGHT)

add_text(s, "KPMG", Inches(0.3), Inches(0.55), Inches(5), Inches(0.85), size=40, bold=True, color=WHITE)
add_text(s, "India  |  Procurement Advisory", Inches(0.3), Inches(1.4), Inches(6.5), Inches(0.35),
          size=13, color=LIGHT)
divider(s, Inches(1.92), GOLD)

add_text(s, "Thank You", Inches(0.3), Inches(2.1), Inches(9.1), Inches(1.05), size=52, bold=True, color=WHITE)
add_text(s, "AI-Powered Procurement Intelligence, from KPMG",
          Inches(0.3), Inches(3.18), Inches(9.1), Inches(0.48), size=16, color=LIGHT)
divider(s, Inches(3.82), LIGHT)

for i, (wk, desc) in enumerate([
    ("Week 1", "Confirm Phase 1 scope — Anomaly Explanation + Vendor Risk Score"),
    ("Week 2", "Schema review — predictions table + confidence/provenance design"),
    ("Week 3", "Build + internal stakeholder walkthrough"),
    ("Week 4", "Pilot on live data — Go / No-Go for Phase 2"),
]):
    cy = Inches(4.05 + i * 0.55)
    add_rect(s, Inches(0.3), cy, Inches(1.0), Inches(0.4), MED)
    add_text(s, wk, Inches(0.3), cy + Inches(0.08), Inches(1.0), Inches(0.28),
              size=10, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, desc, Inches(1.45), cy + Inches(0.08), Inches(9.5), Inches(0.28), size=11, color=MUTED)

add_text(s, "getdev24@gmail.com", Inches(0.3), Inches(6.35), Inches(6), Inches(0.35), size=12, color=GOLD)
add_rect(s, 0, Inches(7.02), W, Inches(0.48), MED)
add_text(s, "KPMG India  |  Procurement Advisory", Inches(0.3), Inches(7.1), Inches(8), Inches(0.35),
          size=10, color=WHITE)


# ── save ───────────────────────────────────────────────────────────────────────
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "IntelliSource_AI_Roadmap.pptx")
prs.save(out)
print(f"Saved  {out}")
print(f"Slides {len(prs.slides)}")
