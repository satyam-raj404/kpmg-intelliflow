"""PPTX generator — small KPMG-branded deck driven by a ReportSpec. Sections
already contain resolved data (tables/chart PNG bytes/narrative text) — the
generator only lays them out; it never receives a manifest key or invents a number.
"""
import io

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

from . import theme

NAVY = RGBColor.from_string(theme.NAVY.lstrip("#"))
LIGHT = RGBColor.from_string(theme.LIGHT.lstrip("#"))
GOLD = RGBColor.from_string(theme.GOLD.lstrip("#"))
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GRAY = RGBColor.from_string(theme.GRAY.lstrip("#"))

W, H = Inches(13.33), Inches(7.5)


def _rect(slide, x, y, w, h, color):
    sh = slide.shapes.add_shape(1, x, y, w, h)
    sh.line.fill.background()
    sh.fill.solid()
    sh.fill.fore_color.rgb = color
    return sh


def _text(slide, text, x, y, w, h, size=14, bold=False, color=WHITE, align=PP_ALIGN.LEFT):
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = "Calibri"


def _header(slide, title):
    _rect(slide, 0, 0, W, Inches(0.7), NAVY)
    _rect(slide, 0, 0, Inches(0.08), Inches(0.7), LIGHT)
    _text(slide, "KPMG IntelliSource — Ask", Inches(0.2), Inches(0.06), Inches(4), Inches(0.3), size=10, color=LIGHT)
    _text(slide, title, Inches(0.2), Inches(0.32), Inches(11), Inches(0.35), size=16, bold=True)


def build_pptx_report(spec: dict) -> bytes:
    """spec = {title, subtitle?, sections: [{heading, kind: table|chart|narrative, data?, chart_png?, narrative?}]}"""
    prs = Presentation()
    prs.slide_width, prs.slide_height = W, H
    blank = prs.slide_layouts[6]

    # Title slide
    s = prs.slides.add_slide(blank)
    _rect(s, 0, 0, W, H, NAVY)
    _rect(s, 0, 0, Inches(0.1), H, LIGHT)
    _text(s, "KPMG", Inches(0.3), Inches(0.5), Inches(4), Inches(0.6), size=28, bold=True)
    _text(s, spec["title"], Inches(0.3), Inches(2.6), Inches(11), Inches(1.0), size=40, bold=True)
    if spec.get("subtitle"):
        _text(s, spec["subtitle"], Inches(0.3), Inches(3.7), Inches(11), Inches(0.5), size=16, color=LIGHT)

    for section in spec["sections"]:
        s = prs.slides.add_slide(blank)
        _rect(s, 0, 0, W, H, RGBColor(0xFF, 0xFF, 0xFF))
        _header(s, section["heading"])

        kind = section.get("kind", "table")
        if kind == "narrative":
            _text(s, section.get("narrative", ""), Inches(0.4), Inches(1.0), Inches(12.5), Inches(5.5),
                  size=14, color=RGBColor(0x1A, 0x1A, 0x1A))

        elif kind == "chart" and section.get("chart_png"):
            img_stream = io.BytesIO(section["chart_png"])
            s.shapes.add_picture(img_stream, Inches(0.6), Inches(1.0), width=Inches(12.0))

        else:  # table
            rows = section.get("data") or []
            if not rows:
                _text(s, "No data.", Inches(0.4), Inches(1.2), Inches(10), Inches(0.5), size=12, color=GRAY)
                continue
            cols = list(rows[0].keys())[:6]  # cap columns so the slide table stays readable
            display_rows = rows[:12]  # cap rows for a "small" slide-sized table
            tbl_shape = s.shapes.add_table(len(display_rows) + 1, len(cols),
                                            Inches(0.4), Inches(1.0), Inches(12.5), Inches(5.5))
            table = tbl_shape.table
            for c_idx, col in enumerate(cols):
                cell = table.cell(0, c_idx)
                cell.text = str(col)
                cell.fill.solid()
                cell.fill.fore_color.rgb = NAVY
                for p in cell.text_frame.paragraphs:
                    for r in p.runs:
                        r.font.color.rgb = WHITE
                        r.font.bold = True
                        r.font.size = Pt(11)
            for r_idx, row in enumerate(display_rows, start=1):
                for c_idx, col in enumerate(cols):
                    cell = table.cell(r_idx, c_idx)
                    cell.text = str(row.get(col, ""))
                    for p in cell.text_frame.paragraphs:
                        for r in p.runs:
                            r.font.size = Pt(10)
            if len(rows) > len(display_rows):
                _text(s, f"...and {len(rows) - len(display_rows)} more rows (see Excel export).",
                      Inches(0.4), Inches(6.7), Inches(10), Inches(0.3), size=9, color=GRAY)

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


if __name__ == "__main__":
    spec = {
        "title": "Vendor Spend Summary",
        "subtitle": "Ask IntelliSource",
        "sections": [
            {"heading": "Top Vendors", "kind": "table",
             "data": [{"vendor": "Infosys", "spend": 100}, {"vendor": "Wipro", "spend": 80}]},
            {"heading": "Key Finding", "kind": "narrative", "narrative": "Infosys is the top vendor by spend."},
        ],
    }
    data = build_pptx_report(spec)
    assert data[:2] == b"PK"
    print("pptx OK —", len(data), "bytes")
