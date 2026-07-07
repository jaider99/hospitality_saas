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
    invoice_items: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Takes a list of invoice items: [{"name": "...", "price": ...}]
    And returns them annotated with match data.
    """
    logger.info(f"Starting Two-Stage Matching for {len(invoice_items)} items...")
    # 1. Exact Match & Alias Match (Cross-Supplier)
    stmt = select(Product).where(Product.status == "ACTIVE")
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
            logger.info(f"Stage 1 (Code): Exact match found for '{name}' -> {product_map_by_name[lower_name]}")
        else:
            unmatched_items.append(item)
            
    # 2. LLM Match for unmatched
    if unmatched_items:
        logger.info(f"Stage 1 (Code): {len(unmatched_items)} items unmatched. Sending to Stage 2 (AI)...")
        
    if unmatched_items and active_products:
        db_product_list = [p.name for p in active_products]
        unmatched_list = [{"name": item["name"]} for item in unmatched_items]
        
        prompt = f"""
        You are an expert hospitality inventory mapping assistant.
        Your task is to map line items from a supplier invoice to the existing database products.
        
        Database Products:
        {json.dumps(db_product_list, indent=2)}
        
        Unmatched Invoice Items:
        {json.dumps(unmatched_list, indent=2)}
        
        Return a JSON object matching the following structure:
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
        Only match if you are highly confident they are the same product (e.g. 'Aloo' vs 'Potato', 'Tomates' vs 'Tomato').
        If no match exists, set matched_database_product_name to null.
        """
        
        try:
            response = _client.chat.completions.create(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            llm_result_text = response.choices[0].message.content
            llm_result = json.loads(llm_result_text)
            
            # Map back to unmatched_items
            if "matches" in llm_result:
                for match in llm_result["matches"]:
                    for item in unmatched_items:
                        if item["name"] == match.get("invoice_item_name"):
                            matched_name = match.get("matched_database_product_name")
                            if matched_name and matched_name.lower() in product_map_by_name:
                                item["matched_product_id"] = product_map_by_name[matched_name.lower()]
                                item["match_type"] = "llm"
                                logger.info(f"Stage 2 (AI): AI found fuzzy match for '{item['name']}' -> '{matched_name}' (Confidence {match.get('confidence')})")
                            else:
                                item["matched_product_id"] = None
                                item["match_type"] = "none"
                                logger.info(f"Stage 2 (AI): AI found no match for '{item['name']}'.")
                            
                            item["confidence"] = match.get("confidence", 0)
                            item["reasoning"] = match.get("reasoning", "")
                            mapped_results.append(item)
                            break
        except Exception as e:
            # On LLM failure, mark all as unmatched
            logger.error(f"LLM matching failed: {e}")
            for item in unmatched_items:
                item["matched_product_id"] = None
                item["match_type"] = "none"
                mapped_results.append(item)
    else:
        # No DB products to match against, mark all as unmatched
        if unmatched_items:
            logger.info("Stage 2 (AI): Skipped because catalog is empty. AI found no match for all items.")
        for item in unmatched_items:
            item["matched_product_id"] = None
            item["match_type"] = "none"
            mapped_results.append(item)

    return mapped_results
