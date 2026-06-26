"""
translation.py
==============
Utility module for English and Spanish internationalization (i18n).
Since the multilingual requirements are not fully finalized yet and will be confirmed 
with the client during development, this serves as a robust placeholder structure.

It provides:
  1. A dictionary of standard system messages and labels in English ('en') and Spanish ('es').
  2. A FastAPI dependency `get_lang` to resolve the client's language preference.
  3. A translation function `translate` to retrieve the localized string.
"""

from fastapi import Header, Query
from typing import Optional

# Standard translations dictionary
TRANSLATIONS = {
    "en": {
        "email_exists": "Email already registered",
        "invalid_credentials": "Invalid credentials",
        "not_found": "Resource not found",
        "unauthorized": "Unauthorized access",
        "price_hike_msg": "Supplier price hike detected: {product_name} (SKU: {sku}) price spiked by {pct:.1f}% (from ${old:.2f} to ${new:.2f}) in invoice #{invoice_number} from {supplier_name}.",
        "recipe_margin_msg": "Recipe margin alert: Recipe \"{recipe_name}\" portion cost rose to ${cost:.2f} ({actual:.1f}% of sale price), exceeding target cost boundary of {target:.1f}%. Prompted by ingredient cost inflation of \"{product_name}\".",
        "labor_excess_msg": "Labor cost exceeds limit at {actual:.1f}% of sales (${cost:.2f} cost). Restaurant cannot afford current waiter floor staff size. Recommendation: Remove/reduce hours for 1 or 2 waiters.",
        "labor_excess_chef_msg": "Labor cost exceeds limit at {actual:.1f}% of sales (${cost:.2f} cost). Recommend reducing chef hours or optimizing shift schedules.",
        "labor_understaffed_msg": "Labor cost is extremely low at {actual:.1f}% of sales (${cost:.2f} cost). Risk of slow table turnaround. Recommendation: Increase staff size (add 1 Chef or Waiter to support the location).",
        "labor_healthy": "Staff cost is within healthy limits.",
        "invalid_shift": "Staff member is already clocked in",
        "not_clocked_in": "Staff member is not clocked in",
    },
    "es": {
        "email_exists": "El correo electrónico ya está registrado",
        "invalid_credentials": "Credenciales inválidas",
        "not_found": "Recurso no encontrado",
        "unauthorized": "Acceso no autorizado",
        "price_hike_msg": "Incremento de precio de proveedor detectado: El precio de {product_name} (SKU: {sku}) subió un {pct:.1f}% (de ${old:.2f} a ${new:.2f}) en la factura #{invoice_number} de {supplier_name}.",
        "recipe_margin_msg": "Alerta de margen de receta: El costo de porción de la receta \"{recipe_name}\" subió a ${cost:.2f} ({actual:.1f}% del precio de venta), excediendo el límite de costo objetivo de {target:.1f}%. Impulsado por la inflación de costo del ingrediente \"{product_name}\".",
        "labor_excess_msg": "El costo laboral supera el límite al {actual:.1f}% de las ventas (costo de ${cost:.2f}). El restaurante no puede costear el tamaño actual del personal de meseros. Recomendación: Reducir horas para 1 o 2 meseros.",
        "labor_excess_chef_msg": "El costo laboral supera el límite al {actual:.1f}% de las ventas (costo de ${cost:.2f}). Se recomienda reducir las horas del chef u optimizar los horarios de los turnos.",
        "labor_understaffed_msg": "El costo laboral es extremadamente bajo al {actual:.1f}% de las ventas (costo de ${cost:.2f}). Riesgo de rotación lenta de mesas. Recomendación: Aumentar el tamaño del personal (agregar 1 chef o mesero).",
        "labor_healthy": "El costo de personal está dentro de los límites saludables.",
        "invalid_shift": "El miembro del personal ya ha registrado su entrada",
        "not_clocked_in": "El miembro del personal no ha registrado su entrada",
    }
}

def get_lang(
    accept_language: Optional[str] = Header(None),
    lang: Optional[str] = Query(None)
) -> str:
    """
    FastAPI dependency to extract language.
    Priority:
      1. Query param 'lang' (e.g. ?lang=es)
      2. 'Accept-Language' header (e.g. 'es' or 'es-ES')
      3. Defaults to 'en'
    """
    if lang in ["en", "es"]:
        return lang
    
    if accept_language:
        # Check first preference in Accept-Language header
        primary = accept_language.split(",")[0].strip().split("-")[0].lower()
        if primary in ["en", "es"]:
            return primary
            
    return "en"

def translate(key: str, lang: str = "en", **kwargs) -> str:
    """
    Translates a key into the target language and formats it with optional arguments.
    """
    lang_dict = TRANSLATIONS.get(lang, TRANSLATIONS["en"])
    text = lang_dict.get(key, TRANSLATIONS["en"].get(key, key))
    try:
        return text.format(**kwargs)
    except Exception:
        return text
