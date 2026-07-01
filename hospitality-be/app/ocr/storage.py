"""
storage.py
==========
PostgreSQL persistence layer matching the full developer blueprint.
"""

from __future__ import annotations
import os
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()
from typing import Optional, List

from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, JSON, func, Numeric
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session

from app.ocr.schema import (
    Invoice as InvoiceDTO, LineItem as LineItemDTO, Supplier as SupplierDTO,
    TaxBracket as TaxBracketDTO, PaymentInfo, DocumentMeta
)

from app.core.setting import settings
DATABASE_URL = settings.DATABASE_URL
if "?" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split("?")[0]

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class SupplierRecord(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255))
    contact_info = Column(String(255))
    vat_id = Column(String(50), unique=True, index=True)
    legal_name = Column(String(255))
    address = Column(Text)
    contacts = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    invoices = relationship("InvoiceRecord", back_populates="supplier")


class InvoiceRecord(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    serialNumber = Column(String(100), unique=True, index=True)
    supplierId = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=True)
    date = Column(DateTime)
    dueDate = Column(DateTime)
    subtotal = Column(Numeric(10, 2), default=0.00)
    tax = Column(Numeric(10, 2), default=0.00)
    total = Column(Numeric(10, 2), default=0.00)
    discount = Column(Numeric(10, 2), default=0.00)
    taxableAdditionalCost = Column(Numeric(10, 2), default=0.00)
    netAdditionalCost = Column(Numeric(10, 2), default=0.00)
    payeAmount = Column(Numeric(10, 2), default=0.00)
    greenPointAmount = Column(Numeric(10, 2), default=0.00)
    ibeeAmount = Column(Numeric(10, 2), default=0.00)
    type = Column(String(50), default="invoice")
    ocrStatus = Column(String(50), default="processed")
    paidStatus = Column(String(50), default="unpaid")
    method = Column(String(50))
    isRefund = Column(Boolean, default=False)
    isReconciled = Column(Boolean, default=False)
    isRecurrent = Column(Boolean, default=False)
    documentInboxEmail = Column(String(255))
    observations = Column(Text)
    fileUrl = Column(String(1000))
    uploaderId = Column(String(100))
    propertyId = Column(String(100))
    categoryId = Column(String(100))
    createdAt = Column(DateTime, server_default=func.now())
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Store raw json for safety
    raw_json = Column(JSON)

    supplier = relationship("SupplierRecord", back_populates="invoices")
    lines = relationship("InvoiceLineRecord", back_populates="invoice", cascade="all, delete-orphan")
    taxBrackets = relationship("TaxBracketRecord", back_populates="invoice", cascade="all, delete-orphan")
    incidents = relationship("OperationalIncidentRecord", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceLineRecord(Base):
    __tablename__ = "invoice_lines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoiceId = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    description = Column(String(500))
    quantity = Column(Numeric(10, 2))
    unitPrice = Column(Numeric(10, 2))
    totalPrice = Column(Numeric(10, 2))
    productId = Column(Integer, nullable=True)
    providerCode = Column(String(100))
    unit = Column(String(50))
    grossPrice = Column(Numeric(10, 2))
    discountPct = Column(Numeric(5, 2))
    appliedDiscount = Column(Numeric(10, 2))
    otherFees = Column(Numeric(10, 2))
    nominalPrice = Column(Numeric(10, 2))

    invoice = relationship("InvoiceRecord", back_populates="lines")


class TaxBracketRecord(Base):
    __tablename__ = "tax_brackets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoiceId = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    subtotal = Column(Numeric(10, 2))
    taxRate = Column(Numeric(5, 4))
    tax = Column(Numeric(10, 2))
    equivalenceSurchargeRate = Column(Numeric(5, 4))
    equivalenceSurcharge = Column(Numeric(10, 2))
    total = Column(Numeric(10, 2))

    invoice = relationship("InvoiceRecord", back_populates="taxBrackets")


class OperationalIncidentRecord(Base):
    __tablename__ = "operational_incidents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String(100))
    severity = Column(String(50))
    message = Column(Text)
    status = Column(String(50), default="OPEN")
    invoiceId = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=True)
    createdAt = Column(DateTime, server_default=func.now())

    invoice = relationship("InvoiceRecord", back_populates="incidents")


# ---------------------------------------------------------------------------
# DTO <-> ORM conversion
# ---------------------------------------------------------------------------

def save_invoice(inv: InvoiceDTO, session: Optional[Session] = None, invoice_id: Optional[int] = None) -> int:
    own_session = session is None
    session = session or SessionLocal()

    try:
        # Delete existing invoice with the same serial number to avoid UniqueViolation
        if inv.serialNumber:
            existing_invoice = session.query(InvoiceRecord).filter_by(serialNumber=inv.serialNumber).first()
            if existing_invoice:
                logger.info(f"Deleting existing InvoiceRecord with serialNumber '{inv.serialNumber}' to prevent unique violation.")
                session.delete(existing_invoice)
                session.flush()

        if invoice_id:
            existing_by_id = session.query(InvoiceRecord).get(invoice_id)
            if existing_by_id:
                logger.info(f"Deleting existing InvoiceRecord with ID '{invoice_id}' to prevent unique violation.")
                session.delete(existing_by_id)
                session.flush()

        # Resolve supplier
        supplier_record = None
        if inv.supplier.vatID:
            supplier_record = session.query(SupplierRecord).filter_by(vat_id=inv.supplier.vatID).first()
        
        if not supplier_record and (inv.supplier.name or inv.supplier.vatID):
            supplier_record = SupplierRecord(
                name=inv.supplier.name,
                vat_id=inv.supplier.vatID,
                legal_name=inv.supplier.legalName,
                address=inv.supplier.address,
                contacts=inv.supplier.contacts or 0
            )
            session.add(supplier_record)
            session.flush()

        from datetime import datetime
        def parse_date(d_str):
            if not d_str: return None
            try: return datetime.fromisoformat(d_str)
            except: return None

        record = InvoiceRecord(
            id=invoice_id,
            serialNumber=inv.serialNumber,
            supplierId=supplier_record.id if supplier_record else None,
            date=parse_date(inv.date),
            dueDate=parse_date(inv.dueDate),
            subtotal=inv.subtotal,
            tax=inv.tax,
            total=inv.total,
            discount=inv.discount,
            taxableAdditionalCost=inv.taxableAdditionalCost,
            netAdditionalCost=inv.netAdditionalCost,
            payeAmount=inv.payeAmount,
            greenPointAmount=inv.greenPointAmount,
            ibeeAmount=inv.ibeeAmount,
            type=inv.type,
            ocrStatus=inv.ocrStatus,
            paidStatus=inv.payment.paidStatus or inv.paidStatus,
            method=inv.payment.method,
            isRefund=inv.isRefund,
            isReconciled=inv.isReconciled,
            documentInboxEmail=inv.documentInboxEmail,
            observations=inv.observations,
            fileUrl=inv.document.fileUrl,
            uploaderId=inv.uploaderID,
            propertyId=inv.propertyID,
            categoryId=inv.categoryID,
            raw_json=inv.to_dict()
        )

        record.lines = [
            InvoiceLineRecord(
                description=li.product,
                quantity=li.quantity,
                unitPrice=li.nominalPrice,
                totalPrice=li.totalPrice,
                providerCode=li.providerCode,
                unit=li.unit,
                grossPrice=li.grossPrice,
                discountPct=li.discountPct,
                appliedDiscount=li.appliedDiscount,
                otherFees=li.otherFees,
                nominalPrice=li.nominalPrice
            )
            for li in inv.items
        ]

        record.taxBrackets = [
            TaxBracketRecord(
                subtotal=tb.subtotal,
                taxRate=(tb.taxRate / 100.0) if tb.taxRate and tb.taxRate >= 1 else tb.taxRate,
                tax=tb.tax,
                equivalenceSurchargeRate=(tb.equivalenceSurchargeRate / 100.0) if tb.equivalenceSurchargeRate and tb.equivalenceSurchargeRate >= 1 else tb.equivalenceSurchargeRate,
                equivalenceSurcharge=tb.equivalenceSurcharge,
                total=tb.total
            )
            for tb in inv.taxBrackets
        ]

        session.add(record)
        session.flush() # get IDs without committing yet
        
        # Update the DTO with generated IDs
        inv.id = record.id
        if supplier_record:
            inv.supplier.id = supplier_record.id
            inv.supplierID = supplier_record.id
            
        # Map line item and tax bracket IDs back to DTO
        for i, li_record in enumerate(record.lines):
            if i < len(inv.items):
                inv.items[i].id = li_record.id
                
        for i, tb_record in enumerate(record.taxBrackets):
            if i < len(inv.taxBrackets):
                inv.taxBrackets[i].id = tb_record.id
        
        # Update raw_json to include the new IDs
        record.raw_json = inv.to_dict()
        
        session.commit()
        return record.id
    except Exception:
        session.rollback()
        raise
    finally:
        if own_session:
            session.close()


def load_invoice(invoice_id: int, session: Optional[Session] = None) -> Optional[InvoiceDTO]:
    own_session = session is None
    session = session or SessionLocal()
    try:
        record = session.get(InvoiceRecord, invoice_id)
        if record is None:
            return None
            
        from typing import cast
        d = cast(dict, record.raw_json)
        
        # Load back DTO logic from raw_json
        from app.ocr.schema import Invoice, Supplier, PaymentInfo, DocumentMeta, LineItem, TaxBracket
        items_data = d.get("items", [])
        for i, db_line in enumerate(record.lines):
            if i < len(items_data):
                items_data[i]["id"] = db_line.id
                
        tbs_data = d.get("taxBrackets", [])
        for i, db_tb in enumerate(record.taxBrackets):
            if i < len(tbs_data):
                tbs_data[i]["id"] = db_tb.id

        return Invoice(
            id=record.id,
            supplierID=record.supplierId,
            supplierName=d.get("supplierName"),
            uploaderID=d.get("uploaderID"),
            propertyID=d.get("propertyID"),
            categoryID=d.get("categoryID"),
            created=d.get("created"),
            updated=d.get("updated"),
            type=d.get("type", "invoice"),
            ocrStatus=d.get("ocrStatus", "processed"),
            documentID=d.get("documentID"),
            isRefund=d.get("isRefund", False),
            paidStatus=d.get("paidStatus", "unpaid"),
            dueDate=d.get("dueDate"),
            date=d.get("date"),
            subtotal=d.get("subtotal", 0.0),
            tax=d.get("tax", 0.0),
            total=d.get("total", 0.0),
            discount=d.get("discount", 0.0),
            taxableAdditionalCost=d.get("taxableAdditionalCost", 0.0),
            netAdditionalCost=d.get("netAdditionalCost", 0.0),
            payeAmount=d.get("payeAmount", 0.0),
            greenPointAmount=d.get("greenPointAmount", 0.0),
            ibeeAmount=d.get("ibeeAmount", 0.0),
            serialNumber=d.get("serialNumber"),
            isReconciled=d.get("isReconciled", False),
            documentInboxEmail=d.get("documentInboxEmail"),
            observations=d.get("observations"),
            supplier=Supplier(**{**d.get("supplier", {}), "id": record.supplierId}),
            payment=PaymentInfo(**d.get("payment", {})),
            document=DocumentMeta(**d.get("document", {})),
            items=[LineItem(**li) for li in items_data],
            taxBrackets=[TaxBracket(**tb) for tb in tbs_data]
        )
    finally:
        if own_session:
            session.close()


def update_invoice(invoice_id: int, inv: InvoiceDTO, session: Optional[Session] = None) -> bool:
    own_session = session is None
    session = session or SessionLocal()

    try:
        record = session.get(InvoiceRecord, invoice_id)
        if not record:
            return False

        from datetime import datetime
        def parse_date(d_str):
            if not d_str: return None
            try: return datetime.fromisoformat(d_str)
            except: return None

        record.serialNumber = inv.serialNumber
        record.date = parse_date(inv.date)
        record.dueDate = parse_date(inv.dueDate)
        record.subtotal = inv.subtotal
        record.tax = inv.tax
        record.total = inv.total
        record.discount = inv.discount
        record.taxableAdditionalCost = inv.taxableAdditionalCost
        record.netAdditionalCost = inv.netAdditionalCost
        record.payeAmount = inv.payeAmount
        record.greenPointAmount = inv.greenPointAmount
        record.ibeeAmount = inv.ibeeAmount
        record.type = inv.type
        record.ocrStatus = inv.ocrStatus
        record.paidStatus = inv.payment.paidStatus or inv.paidStatus
        record.method = inv.payment.method
        record.isRefund = inv.isRefund
        record.isReconciled = inv.isReconciled
        record.documentInboxEmail = inv.documentInboxEmail
        record.observations = inv.observations
        
        # NOTE: fileUrl is intentionally NOT updated here to protect it as requested.
        
        record.uploaderId = inv.uploaderID
        record.propertyId = inv.propertyID
        record.categoryId = inv.categoryID

        # Resolve/update supplier in SQLAlchemy tables
        if inv.supplier:
            supplier_record = None
            if inv.supplier.vatID:
                supplier_record = session.query(SupplierRecord).filter_by(vatID=inv.supplier.vatID).first()
            if not supplier_record and inv.supplier.name and inv.supplier.name != "Unknown Supplier":
                supplier_record = session.query(SupplierRecord).filter(SupplierRecord.name.ilike(inv.supplier.name)).first()
                
            if not supplier_record and (inv.supplier.name or inv.supplier.vatID):
                supplier_record = SupplierRecord(
                    name=inv.supplier.name or "Unknown Supplier",
                    vatID=inv.supplier.vatID,
                    legalName=inv.supplier.legalName,
                    address=inv.supplier.address,
                    contacts=inv.supplier.contacts or 0
                )
                session.add(supplier_record)
                session.flush()
            elif supplier_record:
                if inv.supplier.name:
                    supplier_record.name = inv.supplier.name
                if inv.supplier.legalName:
                    supplier_record.legalName = inv.supplier.legalName
                if inv.supplier.vatID:
                    supplier_record.vatID = inv.supplier.vatID
                if inv.supplier.address:
                    supplier_record.address = inv.supplier.address
                session.add(supplier_record)
                session.flush()

            if supplier_record:
                record.supplierId = supplier_record.id

        # Update line items (preserve IDs) - with proper deletion
        existing_lines = {li.id: li for li in record.lines}
        new_lines = []
        for li in inv.items:
            if li.id and li.id in existing_lines:
                db_line = existing_lines.pop(li.id)
                db_line.description = li.product
                db_line.quantity = li.quantity
                db_line.unitPrice = li.nominalPrice
                db_line.totalPrice = li.totalPrice
                db_line.providerCode = li.providerCode
                db_line.unit = li.unit
                db_line.grossPrice = li.grossPrice
                db_line.discountPct = li.discountPct
                db_line.appliedDiscount = li.appliedDiscount
                db_line.otherFees = li.otherFees
                db_line.nominalPrice = li.nominalPrice
                new_lines.append(db_line)
            else:
                new_lines.append(InvoiceLineRecord(
                    description=li.product,
                    quantity=li.quantity,
                    unitPrice=li.nominalPrice,
                    totalPrice=li.totalPrice,
                    providerCode=li.providerCode,
                    unit=li.unit,
                    grossPrice=li.grossPrice,
                    discountPct=li.discountPct,
                    appliedDiscount=li.appliedDiscount,
                    otherFees=li.otherFees,
                    nominalPrice=li.nominalPrice
                ))
        
        # Delete orphaned line items
        for db_line in existing_lines.values():
            session.delete(db_line)
        
        # Flush deletions to ensure they're processed
        session.flush()
        record.lines = new_lines

        # Update tax brackets (preserve IDs)
        existing_tbs = {tb.id: tb for tb in record.taxBrackets}
        new_tbs = []
        for tb in inv.taxBrackets:
            # We don't have id on TaxBracketDTO yet, but let's just recreate them
            pass
        
        # Delete old tax brackets
        for tb in list(record.taxBrackets):
            session.delete(tb)
        
        # Flush deletions
        session.flush()
        
        record.taxBrackets = [
            TaxBracketRecord(
                subtotal=tb.subtotal,
                taxRate=(tb.taxRate / 100.0) if tb.taxRate and tb.taxRate >= 1 else tb.taxRate,
                tax=tb.tax,
                equivalenceSurchargeRate=(tb.equivalenceSurchargeRate / 100.0) if tb.equivalenceSurchargeRate and tb.equivalenceSurchargeRate >= 1 else tb.equivalenceSurchargeRate,
                equivalenceSurcharge=tb.equivalenceSurcharge,
                total=tb.total
            )
            for tb in inv.taxBrackets
        ]

        session.flush() # get IDs for any new line items
        
        # Map line item IDs back to DTO
        for i, li_record in enumerate(record.lines):
            if i < len(inv.items):
                inv.items[i].id = li_record.id
                
        # Map tax bracket IDs back to DTO
        for i, tb_record in enumerate(record.taxBrackets):
            if i < len(inv.taxBrackets):
                inv.taxBrackets[i].id = tb_record.id

        record.raw_json = inv.to_dict()
        session.commit()
        return True
    except Exception:
        session.rollback()
        raise
    finally:
        if own_session:
            session.close()

def list_all_invoices(session: Optional[Session] = None, limit: int = 100, offset: int = 0) -> List[InvoiceRecord]:
    own_session = session is None
    session = session or SessionLocal()
    try:
        return session.query(InvoiceRecord).order_by(InvoiceRecord.createdAt.desc()).offset(offset).limit(limit).all()
    finally:
        if own_session:
            session.close()

def init_db():
    Base.metadata.create_all(engine)
    print(f"Tables created on {DATABASE_URL}")

if __name__ == "__main__":
    init_db()