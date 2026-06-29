import os
import fitz
import cv2
import numpy as np

def pdf_to_cv2(pdf_path: str, dpi: int = 300):
    doc = fitz.open(pdf_path)
    page = doc[0]
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    img_data = pix.tobytes("png")
    
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

def run_ppstructure():
    from paddleocr import PPStructureV3
    import traceback
    
    # Initialize PP-StructureV3 
    print("Initializing table engine...")
    table_engine = PPStructureV3()

    TEST_INVOICES = [
        "/Users/tsc/Desktop/git_ocr/document (10).pdf"
    ]
    
    for pdf_path in TEST_INVOICES:
        print(f"\n{'='*60}")
        print(f"  PP-StructureV3  →  {pdf_path}")
        print(f"{'='*60}")
        
        try:
            print("Converting PDF to CV2 image...")
            img = pdf_to_cv2(pdf_path)
            
            # Run PP-Structure
            print("Running prediction...")
            results = table_engine.predict(img)
            print("Prediction finished!")
            
            # Print Markdown or HTML results
            if isinstance(results, dict):
                results = [results]
                
            for res in results:
                print(f"Type of res: {type(res)}")
                if hasattr(res, 'html'):
                    print("── HTML Table Extract ──")
                    print(res.html)
                elif isinstance(res, dict) and 'html' in res:
                    print("── HTML Table Extract ──")
                    print(res['html'])
                else:
                    print(res)
                    
        except Exception as e:
            print(f"Error processing {pdf_path}: {e}")
            traceback.print_exc()

if __name__ == '__main__':
    run_ppstructure()
