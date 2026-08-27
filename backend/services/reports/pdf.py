"""PDF generator — ReportLab, in-depth report. Cover, sections (table / chart /
narrative), footer. Sections already contain resolved data — no manifest key,
no model-authored number reaches this module.
"""
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from . import theme

_NAVY = colors.HexColor(theme.NAVY)
_LIGHT = colors.HexColor(theme.LIGHT)
_GRAY = colors.HexColor(theme.GRAY)
_LTGRAY = colors.HexColor(theme.LTGRAY)

_styles = getSampleStyleSheet()
_title_style = ParagraphStyle("KPMGTitle", parent=_styles["Title"], textColor=_NAVY, fontSize=28, spaceAfter=6)
_subtitle_style = ParagraphStyle("KPMGSubtitle", parent=_styles["Normal"], textColor=_LIGHT, fontSize=13)
_heading_style = ParagraphStyle("KPMGHeading", parent=_styles["Heading2"], textColor=_NAVY, spaceBefore=14, spaceAfter=8)
_body_style = ParagraphStyle("KPMGBody", parent=_styles["Normal"], fontSize=10.5, leading=15)


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(_NAVY)
    canvas.rect(0, 0, A4[0], 1.1 * cm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(1 * cm, 0.35 * cm, "KPMG IntelliSource — Ask IntelliSource generated report")
    canvas.drawRightString(A4[0] - 1 * cm, 0.35 * cm, f"Page {doc.page}")
    canvas.restoreState()


def _table_flowable(rows: list[dict], max_rows: int = 40) -> Table:
    cols = list(rows[0].keys())
    display_rows = rows[:max_rows]
    data = [cols] + [[str(r.get(c, "")) for c in cols] for r in display_rows]
    t = Table(data, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), _NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _LTGRAY]),
        ("GRID", (0, 0), (-1, -1), 0.5, _GRAY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def build_pdf_report(spec: dict) -> bytes:
    """spec = {title, subtitle?, sections: [{heading, kind: table|chart|narrative, data?, chart_png?, narrative?}]}"""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=1.5 * cm,
                             leftMargin=1.8 * cm, rightMargin=1.8 * cm)
    story = []

    story.append(Spacer(1, 4 * cm))
    story.append(Paragraph("KPMG", ParagraphStyle("KPMGWordmark", fontSize=22, textColor=_NAVY, fontName="Helvetica-Bold")))
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(spec["title"], _title_style))
    if spec.get("subtitle"):
        story.append(Paragraph(spec["subtitle"], _subtitle_style))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(f"Generated {datetime.now().strftime('%d %b %Y, %H:%M')} — Ask IntelliSource",
                            ParagraphStyle("meta", fontSize=9, textColor=_GRAY)))
    story.append(PageBreak())

    for section in spec["sections"]:
        story.append(Paragraph(section["heading"], _heading_style))
        kind = section.get("kind", "table")

        if kind == "narrative":
            story.append(Paragraph(section.get("narrative", ""), _body_style))

        elif kind == "chart" and section.get("chart_png"):
            img_buf = io.BytesIO(section["chart_png"])
            story.append(Image(img_buf, width=16 * cm, height=9.6 * cm))

        else:
            rows = section.get("data") or []
            if not rows:
                story.append(Paragraph("No data.", _body_style))
            else:
                story.append(_table_flowable(rows))
                if len(rows) > 40:
                    story.append(Spacer(1, 0.2 * cm))
                    story.append(Paragraph(f"...and {len(rows) - 40} more rows (see Excel export).",
                                            ParagraphStyle("note", fontSize=8, textColor=_GRAY)))
        story.append(Spacer(1, 0.4 * cm))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()


if __name__ == "__main__":
    spec = {
        "title": "Procurement KPI Report",
        "subtitle": "Generated on demand",
        "sections": [
            {"heading": "Summary", "kind": "narrative", "narrative": "Total spend is grounded in live data."},
            {"heading": "Top Vendors", "kind": "table",
             "data": [{"vendor": "Infosys", "spend": 100}, {"vendor": "Wipro", "spend": 80}]},
        ],
    }
    data = build_pdf_report(spec)
    assert data[:4] == b"%PDF", "not a valid PDF"
    print("pdf OK —", len(data), "bytes")
