"""
triage.py
=========
Sits in front of table_extract.py. Decides, per invoice page, whether the
extraction result is trustworthy enough to accept automatically, or should
be flagged for manual review.

No LLM calls anywhere in this module, and no separate OCR pass — it reuses
the confidence/text that pipeline.py's ingest() stage already computed.
Pure heuristics on top of existing data, fully offline.

Why this exists: your invoice set spans several failure modes that a table
model will silently produce *wrong* output for rather than fail loudly on:
  - rotated/photographed receipts (Artyplan, Apple, La Ribera) — OCR runs
    but on sideways text, confidence drops hard
  - handwritten forms (ICE Quality, Lahermosa) — PP-OCR's printed-text
    recognizer just isn't trained for handwriting; it'll emit *something*
    with low confidence rather than refusing
  - label/value layouts with no real grid (Apple, Artyplan) — table model
    may detect a spurious "table" with 1-2 garbled cells
  - multiple documents in one photo (Artyplan: card slip + invoice) — table
    model may merge unrelated regions into one "table"

Strategy: compute an OCR confidence score + a handwriting heuristic +
a structural sanity check, and only accept results above threshold.
Everything else goes to review_queue.jsonl with the reason attached, so a
human looks at exactly the cases that need it instead of every invoice.

Install (same as table_extract.py, plus none extra):
    pip install paddleocr paddlepaddle pdfplumber pymupdf opencv-python-headless beautifulsoup4
"""

from __future__ import annotations
from typing import Optional
import json
import logging
import os
import time

logger = logging.getLogger(__name__)

REVIEW_QUEUE_PATH = os.environ.get("REVIEW_QUEUE_PATH", "review_queue.jsonl")


# ---------------------------------------------------------------------------
# Handwriting heuristic
# ---------------------------------------------------------------------------

def looks_handwritten(avg_confidence: Optional[float],
                       low_conf_ratio: Optional[float] = None,
                       token_count: Optional[int] = None) -> bool:
    """Heuristic, not a classifier: handwritten content reliably produces
    low average confidence, often with a high proportion of low-confidence
    tokens, even though *some* text gets detected (unlike a blank page).

    avg_confidence is on a 0.0-1.0 scale, matching ingest.py's
    PageResult.avg_confidence (native PDFs: 1.0; OCR'd pages: avg rec_score).
    low_conf_ratio/token_count come straight from PageResult — pass
    page_result.low_conf_ratio and page_result.token_count directly.

    Will mis-flag some very messy printed receipts as 'handwritten', which
    is acceptable since both cases should go to review anyway.
    """
    if avg_confidence is None:
        return False
    if low_conf_ratio is not None and token_count:
        return token_count > 0 and avg_confidence < 0.55 and low_conf_ratio > 0.5
    return avg_confidence < 0.55


# ---------------------------------------------------------------------------
# Review queue logging — called from pipeline.py with the Invoice it already
# built, not a separate parallel result object.
# ---------------------------------------------------------------------------

def log_to_review_queue(file_path: str, reason: str, inv=None, raw_text_preview: str = "") -> None:
    """Appends a JSON line to the review queue file. Call this from
    pipeline.py at the point a hard-floor / handwriting check fails, instead
    of (or in addition to) setting inv.needs_review — this gives you a
    flat, greppable log of exactly which files need a human look and why,
    separate from whatever's in the DB.
    """
    entry = {
        "file_path": file_path,
        "reason": reason,
        "ocr_confidence": getattr(inv, "ocr_confidence", None) if inv else None,
        "serial_number": getattr(inv, "serialNumber", None) if inv else None,
        "items_found": len(getattr(inv, "items", []) or []) if inv else 0,
        "raw_text_preview": raw_text_preview[:300],
        "flagged_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    try:
        with open(REVIEW_QUEUE_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        logger.exception("Failed to write review queue entry for %s", file_path)

    logger.warning("Flagged for review: %s (%s)", file_path, reason)
