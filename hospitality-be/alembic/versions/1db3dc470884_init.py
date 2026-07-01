"""init

Revision ID: 1db3dc470884
Revises: 
Create Date: 2026-06-29 10:45:48.870713

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '1db3dc470884'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create SQLModel tables
    op.create_table('aiinsight',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('content', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('operationalincident',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('severity', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('message', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('recipe',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('target_cost_percentage', sa.Float(), nullable=False),
    sa.Column('sale_price', sa.Float(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('restaurant',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('address', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('phone', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('tax_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('timezone', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('operational_status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('settings_json', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_restaurant_name'), 'restaurant', ['name'], unique=False)
    op.create_table('staffmember',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('role', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('hourly_rate', sa.Float(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('supplier',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('legal_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('vat_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('address', sa.Text(), nullable=True),
    sa.Column('contacts', sa.Integer(), server_default=sa.text('0'), nullable=True),
    sa.Column('contact_info', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_supplier_name'), 'supplier', ['name'], unique=False)
    op.create_index(op.f('ix_supplier_vat_id'), 'supplier', ['vat_id'], unique=False)
    op.create_table('invoice',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('invoice_number', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('supplier_id', sa.Integer(), nullable=True),
    sa.Column('issue_date', sa.DateTime(), nullable=True),
    sa.Column('total_amount', sa.Float(), nullable=False),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('raw_text', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('document_type', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('document_number', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('document_date', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('uploaded_by', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('supplier_display_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('supplier_legal_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('supplier_tax_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('supplier_address', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('supplier_contact_count', sa.Integer(), nullable=True),
    sa.Column('base_amount', sa.Float(), nullable=True),
    sa.Column('iva_amount', sa.Float(), nullable=True),
    sa.Column('discount', sa.Float(), nullable=True),
    sa.Column('paye', sa.Float(), nullable=True),
    sa.Column('green_point', sa.Float(), nullable=True),
    sa.Column('ibee', sa.Float(), nullable=True),
    sa.Column('attributable_cost', sa.Float(), nullable=True),
    sa.Column('tax_free_costs', sa.Float(), nullable=True),
    sa.Column('total_with_iva', sa.Float(), nullable=True),
    sa.Column('reconciliation_status', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('payment_status', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('currency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('source_file', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('language_detected', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('extraction_method', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('ocr_confidence', sa.Float(), nullable=True),
    sa.Column('needs_review', sa.Boolean(), nullable=False),
    sa.Column('review_reasons', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('raw_ocr_json', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.ForeignKeyConstraint(['supplier_id'], ['supplier.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invoice_invoice_number'), 'invoice', ['invoice_number'], unique=False)
    op.create_index(op.f('ix_invoice_needs_review'), 'invoice', ['needs_review'], unique=False)
    op.create_index(op.f('ix_invoice_supplier_tax_id'), 'invoice', ['supplier_tax_id'], unique=False)
    op.create_table('staffshift',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('staff_id', sa.Integer(), nullable=False),
    sa.Column('clock_in', sa.DateTime(), nullable=False),
    sa.Column('clock_out', sa.DateTime(), nullable=True),
    sa.Column('total_hours', sa.Float(), nullable=True),
    sa.Column('total_pay', sa.Float(), nullable=True),
    sa.ForeignKeyConstraint(['staff_id'], ['staffmember.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('suppliedproduct',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('sku', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('supplier_id', sa.Integer(), nullable=False),
    sa.Column('current_price', sa.Float(), nullable=False),
    sa.Column('unit', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['supplier_id'], ['supplier.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_suppliedproduct_sku'), 'suppliedproduct', ['sku'], unique=True)
    op.create_table('user',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('supertokens_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('first_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('last_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('phone', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('role', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('restaurant_id', sa.Integer(), nullable=True),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_by', sa.Integer(), nullable=True),
    sa.Column('invitation_sent_at', sa.DateTime(), nullable=True),
    sa.Column('invitation_expires_at', sa.DateTime(), nullable=True),
    sa.Column('last_login_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['restaurant_id'], ['restaurant.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_email'), 'user', ['email'], unique=True)
    op.create_index(op.f('ix_user_supertokens_id'), 'user', ['supertokens_id'], unique=True)
    op.create_table('auditlog',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('actor_id', sa.Integer(), nullable=True),
    sa.Column('action', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('target_user_id', sa.Integer(), nullable=False),
    sa.Column('details', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['actor_id'], ['user.id'], ),
    sa.ForeignKeyConstraint(['target_user_id'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_auditlog_action'), 'auditlog', ['action'], unique=False)
    op.create_table('invoiceline',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('invoice_id', sa.Integer(), nullable=False),
    sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('quantity', sa.Float(), nullable=False),
    sa.Column('unit_price', sa.Float(), nullable=False),
    sa.Column('total_price', sa.Float(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=True),
    sa.Column('provider_code', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('product', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('unit', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('gross_price', sa.Float(), nullable=True),
    sa.Column('discount_pct', sa.Float(), nullable=True),
    sa.Column('applied_discount', sa.Float(), nullable=True),
    sa.Column('other_fees', sa.Float(), nullable=True),
    sa.Column('nominal_price', sa.Float(), nullable=True),
    sa.Column('iva_pct', sa.Float(), nullable=True),
    sa.Column('base', sa.Float(), nullable=True),
    sa.ForeignKeyConstraint(['invoice_id'], ['invoice.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['product_id'], ['suppliedproduct.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('invoicetaxbracket',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('invoice_id', sa.Integer(), nullable=False),
    sa.Column('rate_pct', sa.Float(), nullable=True),
    sa.Column('base', sa.Float(), nullable=True),
    sa.Column('iva_amount', sa.Float(), nullable=True),
    sa.Column('row_total', sa.Float(), nullable=True),
    sa.Column('equivalence_surcharge_rate', sa.Float(), nullable=True),
    sa.Column('equivalence_surcharge', sa.Float(), nullable=True),
    sa.ForeignKeyConstraint(['invoice_id'], ['invoice.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('productcosthistory',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('price', sa.Float(), nullable=False),
    sa.Column('changed_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['suppliedproduct.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('recipeingredient',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('recipe_id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('quantity', sa.Float(), nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['suppliedproduct.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['recipe_id'], ['recipe.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('suppliers',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=255), nullable=True),
    sa.Column('contactInfo', sa.String(length=255), nullable=True),
    sa.Column('vatID', sa.String(length=50), nullable=True),
    sa.Column('legalName', sa.String(length=255), nullable=True),
    sa.Column('address', sa.Text(), nullable=True),
    sa.Column('contacts', sa.Integer(), nullable=True),
    sa.Column('createdAt', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_suppliers_vatID'), 'suppliers', ['vatID'], unique=True)
    op.create_table('invoices',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('serialNumber', sa.String(length=100), nullable=True),
    sa.Column('supplierId', sa.Integer(), nullable=True),
    sa.Column('date', sa.DateTime(), nullable=True),
    sa.Column('dueDate', sa.DateTime(), nullable=True),
    sa.Column('subtotal', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('tax', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('total', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('discount', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('taxableAdditionalCost', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('netAdditionalCost', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('payeAmount', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('greenPointAmount', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('ibeeAmount', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('type', sa.String(length=50), nullable=True),
    sa.Column('ocrStatus', sa.String(length=50), nullable=True),
    sa.Column('paidStatus', sa.String(length=50), nullable=True),
    sa.Column('method', sa.String(length=50), nullable=True),
    sa.Column('isRefund', sa.Boolean(), nullable=True),
    sa.Column('isReconciled', sa.Boolean(), nullable=True),
    sa.Column('isRecurrent', sa.Boolean(), nullable=True),
    sa.Column('documentInboxEmail', sa.String(length=255), nullable=True),
    sa.Column('observations', sa.Text(), nullable=True),
    sa.Column('fileUrl', sa.String(length=1000), nullable=True),
    sa.Column('uploaderId', sa.String(length=100), nullable=True),
    sa.Column('propertyId', sa.String(length=100), nullable=True),
    sa.Column('categoryId', sa.String(length=100), nullable=True),
    sa.Column('createdAt', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.Column('updatedAt', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.Column('raw_json', sa.JSON(), nullable=True),
    sa.ForeignKeyConstraint(['supplierId'], ['suppliers.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invoices_serialNumber'), 'invoices', ['serialNumber'], unique=True)
    op.create_table('invoice_lines',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('invoiceId', sa.Integer(), nullable=False),
    sa.Column('description', sa.String(length=500), nullable=True),
    sa.Column('quantity', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('unitPrice', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('totalPrice', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('productId', sa.Integer(), nullable=True),
    sa.Column('providerCode', sa.String(length=100), nullable=True),
    sa.Column('unit', sa.String(length=50), nullable=True),
    sa.Column('grossPrice', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('discountPct', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('appliedDiscount', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('otherFees', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('nominalPrice', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.ForeignKeyConstraint(['invoiceId'], ['invoices.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('operational_incidents',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('type', sa.String(length=100), nullable=True),
    sa.Column('severity', sa.String(length=50), nullable=True),
    sa.Column('message', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=True),
    sa.Column('invoiceId', sa.Integer(), nullable=True),
    sa.Column('createdAt', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['invoiceId'], ['invoices.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('tax_brackets',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('invoiceId', sa.Integer(), nullable=False),
    sa.Column('subtotal', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('taxRate', sa.Numeric(precision=5, scale=4), nullable=True),
    sa.Column('tax', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('equivalenceSurchargeRate', sa.Numeric(precision=5, scale=4), nullable=True),
    sa.Column('equivalenceSurcharge', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('total', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.ForeignKeyConstraint(['invoiceId'], ['invoices.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('recipeingredient')
    op.drop_table('productcosthistory')
    op.drop_table('invoicetaxbracket')
    op.drop_table('invoiceline')
    op.drop_index(op.f('ix_auditlog_action'), table_name='auditlog')
    op.drop_table('auditlog')
    op.drop_index(op.f('ix_user_supertokens_id'), table_name='user')
    op.drop_index(op.f('ix_user_email'), table_name='user')
    op.drop_table('user')
    op.drop_index(op.f('ix_suppliedproduct_sku'), table_name='suppliedproduct')
    op.drop_table('suppliedproduct')
    op.drop_table('staffshift')
    op.drop_index(op.f('ix_invoice_supplier_tax_id'), table_name='invoice')
    op.drop_index(op.f('ix_invoice_needs_review'), table_name='invoice')
    op.drop_index(op.f('ix_invoice_invoice_number'), table_name='invoice')
    op.drop_table('invoice')
    op.drop_index(op.f('ix_supplier_vat_id'), table_name='supplier')
    op.drop_index(op.f('ix_supplier_name'), table_name='supplier')
    op.drop_table('supplier')
    op.drop_table('staffmember')
    op.drop_index(op.f('ix_restaurant_name'), table_name='restaurant')
    op.drop_table('restaurant')
    op.drop_table('recipe')
    op.drop_table('operationalincident')
    op.drop_table('aiinsight')
    op.drop_table('tax_brackets')
    op.drop_table('operational_incidents')
    op.drop_table('invoice_lines')
    op.drop_index(op.f('ix_invoices_serialNumber'), table_name='invoices')
    op.drop_table('invoices')
    op.drop_index(op.f('ix_suppliers_vatID'), table_name='suppliers')
    op.drop_table('suppliers')
    # ### end Alembic commands ###
