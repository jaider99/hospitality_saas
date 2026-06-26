import json
import logging
import hashlib
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from sqlmodel import Session, select
from fastapi import HTTPException
from google import genai
from google.genai import types


from app.core.setting import settings
from app.core.config import QDRANT_COLLECTION_NAME, EMBEDDING_MODEL_NAME, GEMINI_MODEL_NAME
from app.db.qdrant import qdrant_client
from app.db.redis import get_cache, set_cache
from app.module.ai.model import AIInsight

logger = logging.getLogger("ai_service")

# Initialize Gemini Client
try:
    # Use the new official Google GenAI Client
    gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
except Exception as e:
    logger.error(f"Failed to initialize Gemini client: {str(e)}")
    gemini_client = None

# Pydantic schemas for Gemini Structured Outputs
class InvoiceLineSchema(BaseModel):
    description: str
    quantity: float
    unitPrice: float
    totalPrice: float
    sku: Optional[str] = None
    unit: Optional[str] = None

class InvoiceSchema(BaseModel):
    invoiceNumber: str
    supplierName: str
    issueDate: str  # ISO date
    totalAmount: float
    lines: List[InvoiceLineSchema]

class InsightSchema(BaseModel):
    title: str
    content: str
    category: str  # FINANCIAL, INVENTORY, LABOR

class AiService:
    def __init__(self):
        self.client = gemini_client

    def generate_embedding(self, text: str) -> List[float]:
        """Generates a 768-dimensional embedding vector via text-embedding-004."""
        if not self.client or settings.GEMINI_API_KEY in ("dummy-key", "your-gemini-api-key-here") or not settings.GEMINI_API_KEY:
            # Fallback 768-dimension vector for testing without api keys
            return [0.0] * 768
            
        try:
            response = self.client.models.embed_content(
                model=EMBEDDING_MODEL_NAME,
                contents=text
            )
            # Retrieve values
            if response.embeddings and len(response.embeddings) > 0:
                return response.embeddings[0].values
            raise ValueError("No embeddings returned from Gemini API")
        except Exception as e:
            logger.error(f"Gemini embedding generation error: {str(e)}")
            # Fallback vector
            return [0.1] * 768

    def store_vector_document(self, id_str: str, text: str, payload: Dict[str, Any]) -> None:
        """Helper to compute embedding and upsert into Qdrant."""
        vector = self.generate_embedding(text)
        point_id = self._string_to_numeric_id(id_str)
        
        try:
            qdrant_client.upsert(
                collection_name=QDRANT_COLLECTION_NAME,
                points=[
                    types.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload={**payload, "content": text}
                    )
                ]
            )
        except Exception as e:
            logger.error(f"Qdrant upsert error for ID {id_str}: {str(e)}")

    def parse_invoice(self, file_bytes: bytes, mime_type: str) -> Dict[str, Any]:
        """
        Multimodal structured extraction of supplier invoices using Gemini 2.0 Flash.
        Saves semantic text reference into Qdrant as background context.
        """
        if not self.client or settings.GEMINI_API_KEY in ("dummy-key", "your-gemini-api-key-here") or not settings.GEMINI_API_KEY:
            # Return dummy parsed data for local testing/verification
            return {
                "invoiceNumber": f"DUMMY-{random_int()}",
                "supplierName": "Dummy Supplier Inc",
                "issueDate": "2026-06-26T00:00:00Z",
                "totalAmount": 100.0,
                "lines": [
                    {
                        "description": "Premium Ingredient",
                        "quantity": 2.0,
                        "unitPrice": 50.0,
                        "totalPrice": 100.0,
                        "sku": "DUM-PROD-01",
                        "unit": "kg"
                    }
                ]
            }

        try:
            response = self.client.models.generate_content(
                model=GEMINI_MODEL_NAME,
                contents=[
                    types.Part.from_bytes(
                        data=file_bytes,
                        mime_type=mime_type
                    ),
                    "Parse the attached invoice. Extract all details including supplier, lines, and total amount, matching the schema strictly."
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=InvoiceSchema
                )
            )
            
            parsed_invoice = json.loads(response.text)
            
            # Store invoice semantic description in Qdrant background
            lines_desc = ", ".join([l.get("description", "") for l in parsed_invoice.get("lines", [])])
            invoice_text = (
                f"Invoice #{parsed_invoice.get('invoiceNumber')} from Supplier '{parsed_invoice.get('supplierName')}' "
                f"issued on {parsed_invoice.get('issueDate')} with total amount ${parsed_invoice.get('totalAmount')}. "
                f"Products itemized: {lines_desc}."
            )
            
            self.store_vector_document(
                id_str=f"invoice_{parsed_invoice.get('invoiceNumber')}",
                text=invoice_text,
                payload={"sourceTable": "Invoice", "invoiceNumber": parsed_invoice.get("invoiceNumber")}
            )
            
            return parsed_invoice
        except Exception as e:
            logger.error(f"Gemini Invoice parsing error: {str(e)}")
            raise HTTPException(
                status_code=500, 
                detail=f"Invoice parsing failed: {str(e)}"
            )

    def answer_query(self, db: Session, query: str, lang: str = "en") -> str:
        """
        Siri-style Chatbot assistant. Queries Qdrant vector matches, compiles live database 
        context (recipes, staff, shifts, products, incidents) and answers via Gemini.
        Caches query responses in Redis for 60 seconds to reduce token overhead.
        Supports bilingual response matching the resolved language preference.
        """
        # 1. Check Redis Cache first
        cache_key = f"cache:chat:{lang}:{query.lower().strip().replace(' ', '_')}"
        cached = get_cache(cache_key)
        if cached:
            logger.info(f"Serving cached chat response for query: '{query}'")
            return cached

        # 2. Fetch live database metrics context
        # Gather recipes, incidents, staff members, shifts, and product catalog items
        from app.module.recipes.model import Recipe
        from app.module.incidents.model import OperationalIncident
        from app.module.labor.model import StaffMember, StaffShift
        from app.module.invoices.model import SuppliedProduct

        recipes = db.exec(select(Recipe)).all()
        incidents = db.exec(select(OperationalIncident).where(OperationalIncident.status == "OPEN")).all()
        staff = db.exec(select(StaffMember)).all()
        
        # Recent shifts
        shifts_stmt = select(StaffShift).order_by(StaffShift.clock_in.desc()).limit(10)
        shifts = db.exec(shifts_stmt).all()
        
        # Catalog items
        products = db.exec(select(SuppliedProduct).limit(10)).all()

        # 3. Query Qdrant for semantic documents matching the search request
        qdrant_context_text = ""
        try:
            query_vector = self.generate_embedding(query)
            search_results = qdrant_client.search(
                collection_name=QDRANT_COLLECTION_NAME,
                query_vector=query_vector,
                limit=3
            )
            if search_results:
                matches = []
                for res in search_results:
                    matches.append(f"- [Qdrant Match (Score: {res.score:.2f})]: {res.payload.get('content')}")
                qdrant_context_text = "\n".join(matches)
        except Exception as e:
            logger.warning(f"Qdrant context lookup failed: {str(e)}")

        # Helper context conversion to JSON serializable objects
        recipes_ctx = []
        for r in recipes:
            ingredients = [{"productId": ing.product_id, "quantity": ing.quantity} for ing in r.ingredients]
            recipes_ctx.append({
                "id": r.id, "name": r.name, 
                "targetCostPercentage": r.target_cost_percentage, 
                "salePrice": r.sale_price, "ingredients": ingredients
            })
            
        incidents_ctx = [{"id": i.id, "type": i.type, "severity": i.severity, "message": i.message, "status": i.status} for i in incidents]
        staff_ctx = [{"id": s.id, "name": s.name, "role": s.role, "hourlyRate": s.hourly_rate} for s in staff]
        shifts_ctx = [
            {"id": sh.id, "staffId": sh.staff_id, "clockIn": sh.clock_in.isoformat(), 
             "clockOut": sh.clock_out.isoformat() if sh.clock_out else None, 
             "totalHours": sh.total_hours, "totalPay": sh.total_pay} for sh in shifts
        ]
        products_ctx = [{"id": p.id, "name": p.name, "sku": p.sku, "currentPrice": p.current_price, "unit": p.unit} for p in products]

        # 4. Compile context and query prompt
        system_instructions = f"""
You are an expert hospitality decision intelligence voice assistant ("Siri-style Chatbot"). 
You assist restaurant managers by answering questions about recipe portion costs, staff efficiency, cost warnings, and invoices.
Be concise, clear, and direct. When asked about numeric figures or calculations (such as labor percentages or supplier cost spikes), perform the math accurately using the live data context provided.

IMPORTANT BILINGUAL REQUIREMENT: 
You must respond in the following language: {"Spanish" if lang == "es" else "English"}.

LIVE RESTAURANT CONTEXT:
---
[Recipes & Ingredients]
{json.dumps(recipes_ctx, indent=2, ensure_ascii=False)}

[Active Incidents / Alerts]
{json.dumps(incidents_ctx, indent=2, ensure_ascii=False)}

[Staff Members]
{json.dumps(staff_ctx, indent=2, ensure_ascii=False)}

[Recent Clocked Shifts]
{json.dumps(shifts_ctx, indent=2, ensure_ascii=False)}

[Recent Catalog Items]
{json.dumps(products_ctx, indent=2, ensure_ascii=False)}

[Relevant Document Excerpts (Qdrant Vector matches)]
{qdrant_context_text or "No vector matches found."}
---
"""

        if not self.client or settings.GEMINI_API_KEY in ("dummy-key", "your-gemini-api-key-here") or not settings.GEMINI_API_KEY:
            return (
                f"[DUMMY MODE - Spanish={lang=='es'}] "
                f"Received query: '{query}'. Context loaded: {len(recipes)} recipes, {len(incidents)} open incidents."
            )

        try:
            response = self.client.models.generate_content(
                model=GEMINI_MODEL_NAME,
                contents=query,
                config=types.GenerateContentConfig(
                    system_instruction=system_instructions
                )
            )
            answer = response.text or "I could not process an answer at this moment."
            
            # Store in Redis Cache (expires in 60 seconds)
            set_cache(cache_key, answer, 60)
            return answer
        except Exception as e:
            logger.error(f"Gemini chatbot query error: {str(e)}")
            return f"Sorry, I encountered an error checking the data: {str(e)}"

    def generate_insights(self, db: Session, lang: str = "en") -> List[Dict[str, Any]]:
        """
        Generates proactive operational optimization recommendations based on cost/labor metrics.
        Returns exactly 3 insights matching Pydantic schema in the requested language.
        Saves insights to PG.
        """
        # Gather metrics
        from app.module.recipes.model import Recipe
        from app.module.incidents.model import OperationalIncident
        from app.module.invoices.model import SuppliedProduct

        recipes = db.exec(select(Recipe)).all()
        incidents = db.exec(select(OperationalIncident)).all()
        products = db.exec(select(SuppliedProduct)).all()

        # Format context data
        recipes_ctx = []
        for r in recipes:
            ingredients = [{"productId": ing.product_id, "quantity": ing.quantity} for ing in r.ingredients]
            recipes_ctx.append({
                "name": r.name, "targetCost": r.target_cost_percentage, 
                "salePrice": r.sale_price, "ingredients": ingredients
            })
        incidents_ctx = [{"type": i.type, "severity": i.severity, "message": i.message} for i in incidents]
        products_ctx = [{"name": p.name, "price": p.current_price, "history": [h.price for h in p.cost_history]} for p in products]

        context_data = {
            "recipes": recipes_ctx,
            "incidents": incidents_ctx,
            "products": products_ctx
        }

        query = f"""
Analyze the provided live context data. Generate exactly 3 high-impact, actionable insights or recommendations for the restaurant.
Classify each under category: FINANCIAL, INVENTORY, or LABOR.

IMPORTANT BILINGUAL REQUIREMENT:
Generate the title and content fields in the following language: {"Spanish" if lang == "es" else "English"}.

Return the suggestions as a JSON array matching the schema.
"""

        if not self.client or settings.GEMINI_API_KEY in ("dummy-key", "your-gemini-api-key-here") or not settings.GEMINI_API_KEY:
            # Return dummy insights
            if lang == "es":
                dummy_insights = [
                    {"title": "Advertencia de Variación de Gastos de Ginebra", "content": "Hendrick's Gin es su gasto de inventario de más rápido crecimiento. Ajuste el precio de venta de Basil Smash para preservar el margen.", "category": "FINANCIAL"},
                    {"title": "Análisis de Subpersonal del Lunes", "content": "Los turnos de cena del lunes muestran un índice de mano de obra extremadamente bajo. Se recomienda agregar 1 mesero.", "category": "LABOR"},
                    {"title": "Alerta de Desperdicio de Alimentos", "content": "Se registraron pérdidas por encima del promedio en Tomates. Revise los controles de almacenamiento.", "category": "INVENTORY"}
                ]
            else:
                dummy_insights = [
                    {"title": "Gin Spends Variance Warning", "content": "Hendrick's Gin is your fastest rising inventory expense. Adjust retail pricing of Basil Smash to preserve margin threshold.", "category": "FINANCIAL"},
                    {"title": "Monday Understaffing Analysis", "content": "Monday dinner shifts show extremely low labor ratios. Recommend adding 1 waiter to support table turnaround.", "category": "LABOR"},
                    {"title": "Food Waste Alert", "content": "Higher than average spoilage logged for Tomatoes. Review storage temperature and rotation controls.", "category": "INVENTORY"}
                ]
        else:
            try:
                response = self.client.models.generate_content(
                    model=GEMINI_MODEL_NAME,
                    contents=[json.dumps(context_data), query],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=List[InsightSchema]
                    )
                )
                dummy_insights = json.loads(response.text)
            except Exception as e:
                logger.error(f"Insights generation error: {str(e)}")
                return []

        # Save to database
        insights_saved = []
        for item in dummy_insights:
            insight = AIInsight(
                title=item.get("title"),
                content=item.get("content"),
                category=item.get("category")
            )
            db.add(insight)
            db.commit()
            db.refresh(insight)
            insights_saved.append(insight)
            
        return [
            {
                "id": i.id,
                "title": i.title,
                "content": i.content,
                "category": i.category,
                "created_at": i.created_at
            } for i in insights_saved
        ]

    def _string_to_numeric_id(self, s: str) -> int:
        """Deterministic string hashing to integer helper."""
        return int(hashlib.md5(s.encode("utf-8")).hexdigest()[:15], 16)

def random_int() -> int:
    import random
    return random.randint(1000, 9999)

ai_service = AiService()
