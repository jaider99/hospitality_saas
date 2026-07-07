import re
import fitz
from typing import List, Dict, Any, Optional

def parse_recipe_text(text: str) -> Optional[Dict[str, Any]]:
    """
    Parses a single page's text from a Haddock PDF export.
    Returns a dict with recipe metadata and ingredients list.
    """
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if not lines:
        return None
        
    is_prep = False
    name = ""
    tag_name = ""
    qty = 1.0
    uom = "ud"
    portions = 1
    ingredients = []
    
    # State machine / parsing headers
    idx = 0
    if idx < len(lines) and lines[idx].lower() in ('dish / drink', 'dish/drink'):
        is_prep = False
        idx += 1
    elif idx < len(lines) and lines[idx].lower() == 'preparation':
        is_prep = True
        idx += 1
        
    if idx < len(lines):
        name = lines[idx]
        idx += 1
        
    if idx < len(lines):
        tag_name = lines[idx]
        idx += 1
        
    # Look for quantity produced and portions before "Ingredients" header
    while idx < len(lines) and lines[idx] != 'Ingredients':
        line = lines[idx]
        if 'quantity produced' in line.lower():
            m = re.search(r'quantity produced\s+([\d\.,]+)\s*(\w+)', line, re.IGNORECASE)
            if m:
                qty_str = m.group(1).replace(',', '.')
                qty = float(qty_str)
                uom = m.group(2)
        elif 'portions' in line.lower():
            m = re.search(r'portions\s+(\d+)', line, re.IGNORECASE)
            if m:
                portions = int(m.group(1))
        idx += 1
        
    if idx < len(lines) and lines[idx] == 'Ingredients':
        idx += 1
        
    # Parse ingredients from remainder of lines
    ing_lines = lines[idx:]
    i = 0
    while i < len(ing_lines):
        curr_line = ing_lines[i]
        
        # Check if the line itself contains quantity at the end, e.g. "VELVET KISS SHOT 30 ml."
        m = re.search(r'^(.*?)\s+([\d\.,]+)\s*(ud|ml|l|gr|g|kg|pcs)\.?$', curr_line, re.IGNORECASE)
        if m:
            ing_name = m.group(1).strip()
            qty_str = m.group(2).replace(',', '.')
            ing_qty = float(qty_str)
            ing_unit = m.group(3)
            ingredients.append({
                "name": ing_name,
                "quantity": ing_qty,
                "unit": ing_unit,
                "supplier": None
            })
            i += 1
            continue
            
        # Otherwise, the line is the ingredient name
        ing_name = curr_line
        supplier = None
        ing_qty = 1.0
        ing_unit = "ud"
        
        i += 1
        if i < len(ing_lines):
            next_line = ing_lines[i]
            
            # Check if next_line is "-" (representing empty/internal supplier)
            if next_line == '-':
                supplier = None
                i += 1
                # The line after should have the quantity
                if i < len(ing_lines):
                    qty_line = ing_lines[i]
                    mq = re.search(r'^([\d\.,]+)\s*(ud|ml|l|gr|g|kg|pcs)\.?$', qty_line, re.IGNORECASE)
                    if mq:
                        qty_str = mq.group(1).replace(',', '.')
                        ing_qty = float(qty_str)
                        ing_unit = mq.group(2)
                        i += 1
            else:
                # Next line might be "Supplier Name <qty> <unit>"
                mq = re.search(r'^(.*?)\s+([\d\.,]+)\s*(ud|ml|l|gr|g|kg|pcs)\.?$', next_line, re.IGNORECASE)
                if mq:
                    supplier = mq.group(1).strip()
                    if supplier == '-':
                        supplier = None
                    qty_str = mq.group(2).replace(',', '.')
                    ing_qty = float(qty_str)
                    ing_unit = mq.group(3)
                    i += 1
                else:
                    # Next line might just be supplier name, and quantity is on the line after
                    if i + 1 < len(ing_lines):
                        after_line = ing_lines[i+1]
                        mq2 = re.search(r'^([\d\.,]+)\s*(ud|ml|l|gr|g|kg|pcs)\.?$', after_line, re.IGNORECASE)
                        if mq2:
                            supplier = next_line
                            qty_str = mq2.group(1).replace(',', '.')
                            ing_qty = float(qty_str)
                            ing_unit = mq2.group(2)
                            i += 2
                            
        ingredients.append({
            "name": ing_name,
            "quantity": ing_qty,
            "unit": ing_unit,
            "supplier": supplier
        })
        
    return {
        "name": name,
        "isPreparation": is_prep,
        "tagName": tag_name,
        "quantityProduced": qty,
        "unitOfMeasure": uom,
        "portions": portions,
        "ingredients": ingredients
    }

def parse_recipes_from_pdf_bytes(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parses a complete Haddock PDF file from memory.
    Extracts structured recipes page-by-page.
    """
    parsed_recipes = []
    # Open PyMuPDF from memory stream
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        text = page.get_text("text")
        recipe = parse_recipe_text(text)
        if recipe and recipe["name"]:
            parsed_recipes.append(recipe)
    return parsed_recipes
