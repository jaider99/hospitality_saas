import os
import cv2
import fitz  # PyMuPDF
from paddleocr import PPStructure
import numpy as np

def process_image(img, table_engine, md_file, page_num=None):
    """
    Extracts layout information and tables from an image, writing the reconstructed
    Markdown format into md_file.
    """
    result = table_engine(img)
    
    result.sort(key=lambda x: x['bbox'][1])
    
    if page_num is not None:
        md_file.write(f"\n## Page {page_num}\n\n")
    else:
        md_file.write(f"\n---\n\n")

    # Collect all text elements with their bounding boxes
    text_elements = []
    
    for region in result:
        region_type = region['type']
        res = region['res']
        
        if region_type == 'table':
            html_content = res.get('html', '')
            md_file.write(f"{html_content}\n\n")
        else:
            if isinstance(res, list):
                for item in res:
                    text = item.get('text', '').strip()
                    if not text:
                        continue
                    
                    bbox = item.get('text_region', [])
                    if len(bbox) == 4:
                        # Center Y and X
                        y_center = sum(pt[1] for pt in bbox) / 4
                        x_center = sum(pt[0] for pt in bbox) / 4
                        text_elements.append({
                            'text': text,
                            'x': x_center,
                            'y': y_center
                        })
            elif isinstance(res, dict) and 'text' in res:
                text = res['text'].strip()
                if text:
                    bbox = res.get('text_region', [])
                    if len(bbox) == 4:
                        y_center = sum(pt[1] for pt in bbox) / 4
                        x_center = sum(pt[0] for pt in bbox) / 4
                    else:
                        y_center, x_center = 0, 0
                    text_elements.append({
                        'text': text,
                        'x': x_center,
                        'y': y_center
                    })

    if text_elements:
        # Sort vertically
        text_elements.sort(key=lambda item: item['y'])
        
        # Group into lines
        lines = []
        current_line = [text_elements[0]]
        y_threshold = 15 # pixels threshold for same line
        
        for item in text_elements[1:]:
            if abs(item['y'] - current_line[-1]['y']) <= y_threshold:
                current_line.append(item)
            else:
                lines.append(current_line)
                current_line = [item]
        if current_line:
            lines.append(current_line)
            
        # Format lines
        for line in lines:
            line.sort(key=lambda item: item['x']) # Sort horizontally
            # Join text on the same line with some spacing
            line_text = " \t ".join(item['text'] for item in line)
            md_file.write(f"{line_text}\n")
        
        md_file.write("\n")

def process_file(file_path, output_md_path, table_engine=None):
    """
    Processes a PDF or image file and writes its full markdown extraction to output_md_path.
    If no table_engine is provided, it initializes one with the optimal settings.
    """
    print(f"Processing: {file_path}")
    
    if table_engine is None:
        table_engine = PPStructure(show_log=True, image_orientation=False, layout=True, table=True, lang='en')
    
    with open(output_md_path, 'a', encoding='utf-8') as md_file:
        md_file.write(f"# Document: {os.path.basename(file_path)}\n\n")
        
        if file_path.lower().endswith('.pdf'):
            doc = fitz.open(file_path)
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                pix = page.get_pixmap(dpi=200)
                img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
                
                if pix.n == 4:
                    img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2RGB)
                elif pix.n == 1:
                    img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2RGB)
                else:
                    img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

                process_image(img_array, table_engine, md_file, page_num=page_num + 1)
            doc.close()
            
        elif file_path.lower().endswith(('.png', '.jpg', '.jpeg')):
            img = cv2.imread(file_path)
            if img is not None:
                process_image(img, table_engine, md_file)
            else:
                print(f"Failed to read image: {file_path}")
        else:
            print(f"Unsupported file format: {file_path}")

def extract_to_markdown(input_file: str, output_md: str):
    """
    Convenience function to extract a document to markdown.
    Ensures the output file is freshly created.
    """
    if os.path.exists(output_md):
        os.remove(output_md)
        
    process_file(input_file, output_md)
    print(f"Extraction completed. Results saved to {output_md}")
