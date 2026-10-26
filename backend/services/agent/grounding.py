"""Anti-hallucination — output-side guard. Every number in the final answer must
trace back to a value actually present in the DataManifest (tool results this
turn). Numbers that don't match anything are flagged, not silently trusted.
"""
import re
from dataclasses import dataclass

_NUMBER_RE = re.compile(r"-?\d[\d,]*(?:\.\d+)?")  # decimal only counts with digits after the dot —
                                                    # avoids swallowing a sentence-ending period
_MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
_DATE_RE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ,]+(\d{4})\b")
_URL_RE = re.compile(r"https?://\S+|/api/\S+")     # identifiers, not data claims — a UUID's hex
                                                    # digit-runs would otherwise look like numbers


@dataclass
class VerificationResult:
    verified_count: int
    unverified: list[str]

    @property
    def all_verified(self) -> bool:
        return len(self.unverified) == 0


def _normalize(token: str) -> float | None:
    """Strip ₹, Cr, %, commas — return a bare float, or None if not numeric."""
    cleaned = token.replace(",", "").replace("₹", "").replace("%", "").strip()
    if not cleaned or cleaned in ("-", "."):
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _iso_dates(text: str) -> list[tuple[tuple[int, int, int], tuple[int, int]]]:
    """[(y, m, d), (start, end)] for every date in text, ISO or '24-Feb-2023' style."""
    out = []
    for m in _DATE_RE.finditer(text):
        if m.group(1):
            ymd = (int(m.group(1)), int(m.group(2)), int(m.group(3)))
        else:
            mon = _MONTHS.get(m.group(5).lower())
            if not mon:
                continue
            ymd = (int(m.group(6)), mon, int(m.group(4)))
        out.append((ymd, m.span()))
    return out


def _manifest_dates(manifest_values: list) -> set[tuple[int, int, int]]:
    found: set[tuple[int, int, int]] = set()

    def walk(v):
        if isinstance(v, str):
            found.update(d for d, _ in _iso_dates(v))
        elif isinstance(v, dict):
            for x in v.values():
                walk(x)
        elif isinstance(v, (list, tuple)):
            for x in v:
                walk(x)

    for v in manifest_values:
        walk(v)
    return found


def _manifest_numbers(manifest_values: list) -> set[float]:
    """Flatten every numeric value that appears anywhere in the manifest's tool results."""
    found: set[float] = set()

    def walk(v):
        if isinstance(v, (int, float)):
            found.add(round(float(v), 2))
        elif isinstance(v, str):
            n = _normalize(v)
            if n is not None:
                found.add(round(n, 2))
        elif isinstance(v, dict):
            for x in v.values():
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)

    for v in manifest_values:
        walk(v)
    return found


# Direct-scale match: near-exact. A small absolute floor covers float/Decimal
# round-tripping through JSON; the relative term covers larger raw values.
_DIRECT_ABS_FLOOR = 1.0
_DIRECT_REL_TOL = 0.0005  # 0.05%

# Cr-scale match (answer says "835.48 Cr", manifest has the raw 8354776000):
# our own _add_cr_hints() formats with 2 decimals, so up to 0.005 Cr = 50,000
# raw rupees of rounding is expected and legitimate, not a hallucination.
_CR_ABS_FLOOR = 50_000.0
_CR_REL_TOL = 0.0005


def verify_numbers(answer_text: str, manifest_values: list) -> VerificationResult:
    """Extract numeric tokens from answer_text; confirm each is present in the
    manifest at raw scale or Cr scale (within a tight, deliberately-explained
    tolerance — see _DIRECT_*/_CR_* above, not a loose blanket percentage).
    Small integers (0-12) are exempt — they're overwhelmingly prose ("3 dashboards",
    "top 5") rather than data claims, and flagging them is pure noise.
    """
    known = _manifest_numbers(manifest_values)
    known_dates = _manifest_dates(manifest_values)
    unverified: list[str] = []
    verified = 0

    # A date is ONE claim, checked against dates present in the data — not three numbers.
    date_spans = []
    for ymd, span in _iso_dates(answer_text):
        date_spans.append(span)
        if ymd in known_dates:
            verified += 1
        else:
            unverified.append(answer_text[span[0]:span[1]])

    url_spans = [m.span() for m in _URL_RE.finditer(answer_text)]

    def _inside_url(pos: int) -> bool:
        return any(start <= pos < end for start, end in url_spans + date_spans)

    for match in _NUMBER_RE.finditer(answer_text):
        if _inside_url(match.start()):
            continue  # part of a URL/artifact id, not a data claim
        token = match.group()
        val = _normalize(token)
        if val is None:
            continue
        if 0 <= val <= 12 and "." not in token:
            continue  # small-integer prose exemption
        if any(abs(val - k) <= max(_DIRECT_ABS_FLOOR, abs(k) * _DIRECT_REL_TOL) for k in known):
            verified += 1
            continue
        # Cr scale (e.g. manifest has raw 8354776000, answer correctly says "835.48 Cr")
        if any(abs(val * 1e7 - k) <= max(_CR_ABS_FLOOR, abs(k) * _CR_REL_TOL) for k in known):
            verified += 1
            continue
        unverified.append(token)

    return VerificationResult(verified_count=verified, unverified=unverified)


def build_citation(tool_name: str, manifest_key: str, summary: str) -> dict:
    return {"tool": tool_name, "manifest_key": manifest_key, "summary": summary}


if __name__ == "__main__":
    manifest_vals = [{"total_po_value": 71300000.0}, [{"vendor": "Infosys", "spend": 26993490.0}]]
    r = verify_numbers("Total PO value is 71300000. Infosys spend is 26993490.", manifest_vals)
    assert r.all_verified, r.unverified
    r2 = verify_numbers("Total spend is 999999999.", manifest_vals)
    assert not r2.all_verified and "999999999" in r2.unverified
    r3 = verify_numbers("There are 3 dashboards and top 5 vendors.", manifest_vals)
    assert r3.all_verified, r3.unverified  # small-int prose exemption
    r4 = verify_numbers(
        "![chart](https://api.chat/artifacts/9d1e2f3a-bcde-4321-9876-abcdef012345) Spend is 71300000.",
        manifest_vals,
    )
    assert r4.all_verified, r4.unverified  # UUID hex digit-runs must not be treated as data claims

    big_vals = [{"spend": 8354776000.0}]
    r5 = verify_numbers("Spend is Rs.835.48 Cr.", big_vals)
    assert r5.all_verified, r5.unverified  # correct Cr conversion, 2-decimal rounding tolerated
    r6 = verify_numbers("Spend is Rs.83.55 Cr.", big_vals)
    assert not r6.all_verified  # off-by-10x conversion error must still be caught
    print("grounding OK")
