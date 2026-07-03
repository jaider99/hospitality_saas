import asyncio
from sqlmodel import Session, select
from app.db.session import engine
from app.module.invoices.model import Invoice
import json

def fix_duplicates():
    with Session(engine) as session:
        invoices = session.exec(select(Invoice).where(Invoice.is_duplicate == True)).all()
        for inv in invoices:
            # Check if it actually has a duplicate
            doc_num = inv.document_number
            inv_num = inv.invoice_number
            supplier_id = inv.supplier_id
            
            if (doc_num or inv_num) and supplier_id:
                conditions = []
                if doc_num: conditions.append(Invoice.document_number == doc_num)
                if inv_num: conditions.append(Invoice.invoice_number == inv_num)
                if doc_num: conditions.append(Invoice.invoice_number == doc_num)
                if inv_num: conditions.append(Invoice.document_number == inv_num)
                
                from sqlmodel import or_
                duplicates = session.query(Invoice).filter(
                    or_(*conditions),
                    Invoice.supplier_id == supplier_id
                ).order_by(Invoice.id).all()
                
                if len(duplicates) == 1 and duplicates[0].id == inv.id:
                    # It's the only one left!
                    inv.is_duplicate = False
                    if inv.review_reasons:
                        try:
                            reasons = json.loads(inv.review_reasons)
                            if isinstance(reasons, list):
                                reasons = [r for r in reasons if not r.startswith("duplicate_invoice")]
                                if not reasons:
                                    inv.review_reasons = None
                                    inv.needs_review = False
                                else:
                                    inv.review_reasons = json.dumps(reasons)
                        except:
                            pass
                    session.add(inv)
                    print(f"Fixed invoice {inv.id} - no longer a duplicate")
        session.commit()

if __name__ == "__main__":
    fix_duplicates()
