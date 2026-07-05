# Raw OCR Text (PaddleOCR Output)

# Invoice (Scanned OCR)

CASA
GAY
1893
PEDIDO
NCLIENTE
DATOS FISCALES
REC67PARTNERS,S.L. 86408
FAROLA B67019018
CL/Antic de Sant Joan,10 08003 Barcelona
SU PEDIDO
PEDIDONO 26/011901FECHA11/06/26
Observaciones:
CODIGO DESCRIPCION
C12193
AVANT GARDE VASO WHISKY BAJO 45cl

--- DOCUMENT INFO COLUMN ---
VENTA ALQUILER
08030 Barcelon
info@casagay.com
DIRECCION DE ENVIO
MOTOR OIL
CARRERAMPLE46
08002 Barcelona
Andrea654.811.030/8-12h.
Horario:
Fecha prevista entrega: 11/06/26
UDS
PRECIO DTO. IMPORTE€
18 2,19 17
32,72

--- INVOICE BODY ---
IMPORTE NETO
32,72 BASE IVA %IVA CUOTA IVA
32,72 21 6,87
TOTALE
39,59
Total 39,59
Metodo de pago:
Giro Bancario
NIF:As8484494-Casa Gay S.A Volum23060,Foli 21,ull B47950,Inscripci6 19
Pägina1de1

--- Marginal Text (Full Resolution) ---
CASA GAY 1893 VENTA C/Roger de Llaria 12-14 o8o1o Barcelona P Tel.:933181495 PEDIDO DATOSFISCALES N"CLIENTE 80798 REC67PARTNERS,S.L DIR B67019018 FAROLA 189.3 C/Rogcr ac 1dria in-14 0801o Barcclona Pa Tal.:.93.318.14.95 DATOS FISGALES NO: CLIENTE REC67 PARTNERS, S.L. B67019018. CL/Antc de Sa C/Roger de LlGria 12-14 ALQUILER Passeig de la Verneda150 Tel.933181495 08o30 Barcelona Administracio@casagay.com Tel.933080104 info@casagay.com 98 DIRECCION DE ENVIO S.L. MOTOROIL CARRRE AIQUTLER 08o10 Barcclona Passcig dc In verncda, 158 Tal.:.93.318 14.95 o8o30:Barcclona Tcl. 93 308.01:04 Into@casagay.com S.I. NIF:As8484494-Casa Gay S.A.Volum 23060,Foli 211,Full B 47950,Inscripci19 NIFA58484494-Casa Gay S.A.Volum 23060,Foli 211,Full B 47950,Inscripci19 Pägina1de1 MPORTEE 32,72 TAL€ 39,59 9.59 TALE 1de1

# Final AI Extraction (JSON)

```json
{
  "id": null,
  "supplierID": null,
  "supplierName": null,
  "uploaderID": null,
  "propertyID": null,
  "categoryID": null,
  "created": null,
  "updated": null,
  "type": "Invoice",
  "ocrStatus": "processed",
  "documentID": null,
  "isRefund": false,
  "paidStatus": "unpaid",
  "dueDate": null,
  "date": "2026-06-11",
  "subtotal": 32.72,
  "tax": 6.87,
  "total": 39.59,
  "discount": 0.0,
  "taxableAdditionalCost": 0.0,
  "netAdditionalCost": 0.0,
  "payeAmount": 0.0,
  "greenPointAmount": 0.0,
  "ibeeAmount": 0.0,
  "serialNumber": "26/011901",
  "taxBrackets": [
    {
      "id": null,
      "subtotal": 32.72,
      "taxRate": 21,
      "tax": 6.87,
      "total": 39.59,
      "equivalenceSurchargeRate": null,
      "equivalenceSurcharge": null
    }
  ],
  "isReconciled": false,
  "isDuplicate": false,
  "documentInboxEmail": "info@casagay.com",
  "observations": null,
  "supplier": {
    "id": null,
    "name": "Casa Gay S.A.",
    "legalName": "Casa Gay S.A.",
    "vatID": "A58484494",
    "address": "C/ Roger de Llúria 12-14, 08010 Barcelona",
    "contacts": 0,
    "contactInfo": "Tel: 93 319 52 06, info@casagay.com"
  },
  "payment": {
    "paidStatus": null,
    "dueDate": null,
    "method": "Giro Bancario"
  },
  "document": {
    "id": null,
    "pdfURL": null,
    "thumbnailJPEGURL": null,
    "thumbnailWEBPURL": null,
    "placeholderURL": null,
    "fileUrl": null
  },
  "items": [
    {
      "id": null,
      "providerCode": "C12193",
      "product": "AVANT GARDE VASO WHISKY BAJO 45cl",
      "quantity": 18,
      "unit": "UDS",
      "grossPrice": 2.19,
      "discountPct": 17,
      "appliedDiscount": 0.3723,
      "otherFees": null,
      "nominalPrice": 1.8177,
      "totalPrice": null,
      "gra": null,
      "u_m": null,
      "iva_pct": 21,
      "base": 32.72
    }
  ],
  "ocr_confidence": 0.966468893819385,
  "confidence": null,
  "llm_confidence": 1.0,
  "needs_review": false,
  "review_reasons": [],
  "ocr_duration": 43.39,
  "llm_duration": 75.87
}
```
