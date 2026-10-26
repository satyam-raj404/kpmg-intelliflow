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

# Neutral tokens for the KPMG-style deck (hairlines, flat panels, text greys)
HAIRLINE = "#D8DFE9"
PANEL    = "#F4F6FA"
CHIP     = "#E6ECF6"
BODY     = "#333940"
CAPTION  = "#697280"
TEAL_POS = "#00A3A1"   # favourable / fourth series

# Cycling palette for multi-series charts (bar groups, pie slices, ...) — blue ladder first
CHART_PALETTE = [NAVY, MED, LIGHT, TEAL_POS, GOLD, RED, GREEN_OK, ORANGE_WARN, GRAY]

FONT_FAMILY = "Arial"
