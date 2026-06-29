"""
Test script: PaddleOCR-VL 1.6 vs current PP-OCRv6
Run:  PYTHONPATH=. python3 test_vl16.py
"""
import time
import fitz           # PyMuPDF
import io
from PIL import Image

# ─── Convert PDF page 0 → PNG bytes ─────────────────────────────────────────
def pdf_to_png(pdf_path: str, dpi: int = 300) -> bytes:
    doc = fitz.open(pdf_path)
    page = doc[0]
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    return pix.tobytes("png")

# ─── Save PNG to a temp file (VL needs a file path) ──────────────────────────
def save_png(png_bytes: bytes, out_path: str):
    img = Image.open(io.BytesIO(png_bytes))
    img.save(out_path)
    return out_path

# ─── INVOICES TO TEST ────────────────────────────────────────────────────────
# Add / remove paths here as needed
TEST_INVOICES = [
    "/Users/tsc/Desktop/git_ocr/document (20).pdf",   # M.A.S.A. – 11 items
]

def run_vl16(pdf_path: str):
    """Run PaddleOCR-VL 1.6 on a PDF and return raw output."""
    from paddleocr import PaddleOCRVL

    png_bytes = pdf_to_png(pdf_path)
    tmp_img = "/tmp/test_vl16_invoice.png"
    save_png(png_bytes, tmp_img)

    print(f"\n{'='*60}")
    print(f"  PaddleOCR-VL 1.6  →  {pdf_path}")
    print(f"{'='*60}")

    t0 = time.time()
    pipeline = PaddleOCRVL(pipeline_version="v1.6")
    elapsed_load = time.time() - t0
    print(f"Model loaded in {elapsed_load:.1f}s")

    QUERY = (
        "Extract all information from this invoice. "
        "Include: supplier name, supplier VAT/CIF number, document number, date, "
        "all line items (code, product name, quantity, unit price, IVA rate %, total amount), "
        "IVA tax breakdown by rate, subtotal, total tax, and grand total. "
        "Return the result as a well-formatted Markdown document with tables."
    )

    t1 = time.time()
    results = pipeline.predict(tmp_img, query=QUERY)
    elapsed_infer = time.time() - t1
    print(f"Inference done in  {elapsed_infer:.1f}s")
    print(f"Total time:        {elapsed_load + elapsed_infer:.1f}s")
    print()

    for res in results:
        # Try to get Markdown output
        if hasattr(res, "markdown"):
            print("── Markdown output ──")
            print(res.markdown)
        elif hasattr(res, "to_dict"):
            print("── Dict output ──")
            import json
            print(json.dumps(res.to_dict(), indent=2, ensure_ascii=False))
        elif hasattr(res, "res"):
            print("── Raw res ──")
            print(res.res)
        else:
            print("── Raw str ──")
            print(str(res))


if __name__ == "__main__":
    print("=" * 60)
    print("  PaddleOCR-VL 1.6  —  Invoice Extraction Test")
    print("=" * 60)
    for pdf in TEST_INVOICES:
        try:
            run_vl16(pdf)
        except Exception as e:
            print(f"\n[ERROR] {pdf}: {e}")
    print("\n\nDone. Check the output above to see if VL 1.6 extracts:")
    print("  ✔  Supplier name & VAT ID")
    print("  ✔  Document number & date")
    print("  ✔  All line items with correct quantities and prices")
    print("  ✔  Tax breakdown (IVA 4% / 10% / 21%)")
