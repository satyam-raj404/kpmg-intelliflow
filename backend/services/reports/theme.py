"""KPMG brand palette — shared by matplotlib charts, Excel, PPTX, and PDF.
Same constants used in kpmg-intelliflow/build_presentation_pptx.py, expressed
as both hex (for reportlab/openpyxl/pptx) and matplotlib-ready hex strings.
"""

NAVY   = "#00338D"
MED    = "#005EB8"
LIGHT  = "#0091DA"
TEAL   = "#0099A8"
GOLD   = "#8F7326"
RED    = "#BC204B"
GRAY   = "#63666A"
LTGRAY = "#F2F2F2"
WHITE  = "#FFFFFF"
DARK   = "#051833"
GREEN_OK = "#007A33"
ORANGE_WARN = "#FF6B00"

# Cycling palette for multi-series charts (bar groups, pie slices, ...)
CHART_PALETTE = [NAVY, MED, LIGHT, TEAL, GOLD, RED, GREEN_OK, ORANGE_WARN, GRAY]

FONT_FAMILY = "Calibri"
