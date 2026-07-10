import os
import json
import logging
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from openai import OpenAI
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.future import select

from app.module.products.model import Product, ProductAlias

LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://openrouter.ai/api/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "openai/gpt-4o")
LLM_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", 1000))

_client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)
logger = logging.getLogger("worker")

class MatchedProductItem(BaseModel):
    invoice_item_name: str = Field(description="The name of the item from the invoice")
    matched_database_product_name: Optional[str] = Field(description="The exact name of the matching product from the database, or null if no semantic match exists")
    confidence: int = Field(description="Confidence score from 0 to 100")
    reasoning: str = Field(description="Brief reasoning for the match or lack thereof")

class ProductMappingResponse(BaseModel):
    matches: List[MatchedProductItem]

async def match_invoice_items(
    db: AsyncSession,
    supplier_id: int,
    invoice_items: List[Dict[str, Any]],
    invoice_id: Optional[int] = None,
    restaurant_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Takes a list of invoice items: [{"name": "...", "price": ...}]
    And returns them annotated with match data.
    """
    logger.warning(f"Starting Two-Stage Matching for {len(invoice_items)} items...")
    
    if restaurant_id is None and invoice_id is not None:
        from app.module.invoices.model import Invoice
        invoice_stmt = select(Invoice).where(Invoice.id == invoice_id)
        invoice_res = await db.execute(invoice_stmt)
        invoice = invoice_res.scalars().first()
        if invoice:
            restaurant_id = invoice.restaurant_id

    # 1. Exact Match & Alias Match (Cross-Supplier)
    stmt = select(Product).where(Product.status == "ACTIVE")
    if restaurant_id is not None:
        stmt = stmt.where(Product.restaurant_id == restaurant_id)
    result = await db.execute(stmt)
    active_products = result.scalars().all()
    
    product_map_by_name = {p.name.lower(): p.id for p in active_products}
    
    # Also get aliases for all active products
    alias_stmt = select(ProductAlias).where(
        ProductAlias.master_product_id.in_([p.id for p in active_products])
    ) if active_products else None
    
    aliases = []
    if alias_stmt is not None:
        alias_result = await db.execute(alias_stmt)
        aliases = alias_result.scalars().all()
        
    for alias in aliases:
        product_map_by_name[alias.alias_name.lower()] = alias.master_product_id

    unmatched_items = []
    mapped_results = []
    
    for item in invoice_items:
        raw_name = item.get("name")
        name = (raw_name or "").strip()
        if not name:
            continue
            
        lower_name = name.lower()
        if lower_name in product_map_by_name:
            # Exact or alias match
            item["matched_product_id"] = product_map_by_name[lower_name]
            item["match_type"] = "exact"
            item["confidence"] = 100
            mapped_results.append(item)
            logger.warning(f"Stage 1 (Code): Exact match found for '{name}' -> {product_map_by_name[lower_name]}")
        else:
            unmatched_items.append(item)
            
    # 2. LLM Match for unmatched
    if unmatched_items:
        logger.warning(f"Stage 1 (Code): {len(unmatched_items)} items unmatched. Sending to Stage 2 (AI)...")
        
    if unmatched_items and active_products:
        db_product_list = [p.name for p in active_products]
        
        chunk_size = 10
        for i in range(0, len(unmatched_items), chunk_size):
            chunk = unmatched_items[i:i + chunk_size]
            unmatched_list = [{"name": item["name"]} for item in chunk]
            
            prompt = f"""
            You are an expert hospitality inventory mapping assistant.
            Your task is to map line items from a supplier invoice to the existing database products.
            
            Database Products:
            {json.dumps(db_product_list, indent=2)}
            
            Unmatched Invoice Items:
            {json.dumps(unmatched_list, indent=2)}
            
            Return a JSON object matching the following strict structure exactly. DO NOT invent new keys or alter the structure.
            
            Example correct response:
            {{
                "matches": [
                    {{
                        "invoice_item_name": "Tomates Peras",
                        "matched_database_product_name": "TOMATO PERA 5KG",
                        "confidence": 95,
                        "reasoning": "Both refer to pear tomatoes, high confidence match."
                    }},
                    {{
                        "invoice_item_name": "Unknown strange item",
                        "matched_database_product_name": null,
                        "confidence": 0,
                        "reasoning": "No similar items exist in the database."
                    }}
                ]
            }}
            
            Only match if you are highly confident they are the same product (e.g. 'Aloo' vs 'Potato', 'Tomates' vs 'Tomato').
            If no match exists, set matched_database_product_name to null.
            """
            
            try:
                response = _client.chat.completions.create(
                    model=LLM_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    max_tokens=LLM_MAX_TOKENS,
                )
                llm_result_text = response.choices[0].message.content
                
                try:
                    llm_result = json.loads(llm_result_text)
                    if "matches" not in llm_result:
                        raise ValueError("Missing 'matches' key in JSON response")
                except Exception as parse_err:
                    logger.warning(f"Stage 2 (AI): Primary model failed to output valid schema ({parse_err}). Invoking fallback model to repair...")
                    FALLBACK_MODEL = "openai/gpt-oss-120b:free" 
                    
                    repair_prompt = f"""
                    You are a JSON repair assistant. 
                    The following output was generated by another AI but it is invalid or incomplete.
                    Please repair it and return ONLY a valid JSON object matching this strict structure exactly:
                    {{
                        "matches": [
                            {{
                                "invoice_item_name": "String",
                                "matched_database_product_name": "String or null",
                                "confidence": 0-100,
                                "reasoning": "String"
                            }}
                        ]
                    }}
                    
                    The original input invoice items that were being mapped:
                    {json.dumps(unmatched_list, indent=2)}
                    
                    Original bad output to repair:
                    {llm_result_text}
                    """
                    
                    if FALLBACK_MODEL:
                        fallback_response = _client.chat.completions.create(
                            model=FALLBACK_MODEL,
                            messages=[{"role": "user", "content": repair_prompt}],
                            response_format={"type": "json_object"},
                            max_tokens=LLM_MAX_TOKENS,
                        )
                        llm_result_text = fallback_response.choices[0].message.content
                        llm_result = json.loads(llm_result_text)
                        logger.warning(f"Stage 2 (AI): Fallback model successfully repaired the JSON.")
                    else:
                        raise ValueError(f"Fallback model not configured. Original error: {parse_err}")
                
                # Save LLM output to markdown file if invoice_id is provided
                if invoice_id is not None:
                    try:
                        os.makedirs("ocr_results", exist_ok=True)
                        md_path = f"ocr_results/invoice_{invoice_id}_llm.md"
                        mode = "a" if i > 0 else "w"
                        with open(md_path, mode, encoding="utf-8") as f:
                            if i == 0:
                                f.write(f"# LLM Product Mapping for Invoice {invoice_id}\n\n")
                            f.write(f"## Chunk {i // chunk_size + 1}\n\n")
                            f.write("### Prompt Sent to LLM\n```text\n")
                            f.write(prompt)
                            f.write("\n```\n\n")
                            f.write("### LLM JSON Response\n```json\n")
                            f.write(json.dumps(llm_result, indent=2, ensure_ascii=False))
                            f.write("\n```\n\n")
                        logger.warning(f"Saved LLM mapping output chunk {i // chunk_size + 1} to {md_path}")
                    except Exception as file_err:
                        logger.error(f"Failed to save LLM mapping output to file: {file_err}")
                
                # Map back to chunk
                if "matches" in llm_result:
                    for match in llm_result["matches"]:
                        for item in chunk:
                            if item["name"] == match.get("invoice_item_name"):
                                matched_name = match.get("matched_database_product_name")
                                if matched_name and matched_name.lower() in product_map_by_name:
                                    item["matched_product_id"] = product_map_by_name[matched_name.lower()]
                                    item["match_type"] = "llm"
                                    logger.warning(f"Stage 2 (AI): AI found fuzzy match for '{item['name']}' -> '{matched_name}' (Confidence {match.get('confidence')})")
                                else:
                                    item["matched_product_id"] = None
                                    item["match_type"] = "none"
                                    logger.warning(f"Stage 2 (AI): AI found no match for '{item['name']}'.")
                                
                                item["confidence"] = match.get("confidence", 0)
                                item["reasoning"] = match.get("reasoning", "")
                                mapped_results.append(item)
                                break
                                
                # Catch any items the LLM completely skipped in its response
                for item in chunk:
                    if "match_type" not in item:
                        item["matched_product_id"] = None
                        item["match_type"] = "none"
                        logger.warning(f"Stage 2 (AI): LLM skipped '{item['name']}'. Defaulting to no match.")
                        mapped_results.append(item)
                        
            except Exception as e:
                # On LLM failure for this chunk, mark all as unmatched
                logger.error(f"LLM matching failed for chunk: {e}")
                for item in chunk:
                    if "match_type" not in item:
                        item["matched_product_id"] = None
                        item["match_type"] = "none"
                        mapped_results.append(item)
    else:
        # No DB products to match against, mark all as unmatched
        for item in unmatched_items:
            item["matched_product_id"] = None
            item["match_type"] = "none"
            mapped_results.append(item)

    return mapped_results
