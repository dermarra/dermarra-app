"""add inventory management (batches, transactions, reservations)

Revision ID: a9322b7ec397
Revises: 2a735e468547
Create Date: 2026-08-24 09:00:00.000000

Replaces Product.stock_quantity with a proper Inventory row per product
(the sole source of truth from here on -- see Inventory model docstring).
Every existing product's stock_quantity is backfilled into an Inventory
row plus one non-expiring "legacy" InventoryBatch, with a matching
PRODUCTION_RECEIPT transaction so the audit ledger is complete from day
one -- no stock is lost, nothing is left implicit.
"""
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a9322b7ec397'
down_revision = '2a735e468547'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'inventory',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('on_hand', sa.Integer(), nullable=False),
        sa.Column('reserved', sa.Integer(), nullable=False),
        sa.Column('reorder_level', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id'),
    )

    op.create_table(
        'inventory_batches',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('batch_number', sa.String(length=60), nullable=False),
        sa.Column('quantity_produced', sa.Integer(), nullable=False),
        sa.Column('quantity_remaining', sa.Integer(), nullable=False),
        sa.Column('unit_cost_cents', sa.Integer(), nullable=True),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('produced_at', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id', 'batch_number', name='uq_batch_product_number'),
    )

    op.create_table(
        'inventory_transactions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('batch_id', sa.String(length=36), nullable=False),
        sa.Column('reference_type', sa.String(length=30), nullable=True),
        sa.Column('reference_id', sa.String(length=36), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['batch_id'], ['inventory_batches.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('inventory_transactions', schema=None) as batch_op:
        batch_op.create_index('ix_inventory_transactions_product_id', ['product_id'])
        batch_op.create_index('ix_inventory_transactions_batch_id', ['batch_id'])
        batch_op.create_index(
            'ix_inventory_transactions_reference', ['reference_type', 'reference_id']
        )

    op.create_table(
        'inventory_reservations',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('order_id', sa.String(length=36), nullable=False),
        sa.Column('order_item_id', sa.String(length=36), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('batch_id', sa.String(length=36), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('released_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
        sa.ForeignKeyConstraint(['order_item_id'], ['order_items.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['batch_id'], ['inventory_batches.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('inventory_reservations', schema=None) as batch_op:
        batch_op.create_index('ix_inventory_reservations_order_id', ['order_id'])
        batch_op.create_index('ix_inventory_reservations_status', ['status'])

    # ---- backfill existing stock into the new tables ----
    connection = op.get_bind()
    products_table = sa.table(
        'products', sa.column('id', sa.String), sa.column('stock_quantity', sa.Integer)
    )
    existing_products = connection.execute(
        sa.select(products_table.c.id, products_table.c.stock_quantity)
    ).fetchall()

    now = datetime.now(timezone.utc)
    inventory_table = sa.table(
        'inventory',
        sa.column('id', sa.String), sa.column('product_id', sa.String),
        sa.column('on_hand', sa.Integer), sa.column('reserved', sa.Integer),
        sa.column('reorder_level', sa.Integer),
    )
    batches_table = sa.table(
        'inventory_batches',
        sa.column('id', sa.String), sa.column('product_id', sa.String),
        sa.column('batch_number', sa.String), sa.column('quantity_produced', sa.Integer),
        sa.column('quantity_remaining', sa.Integer), sa.column('unit_cost_cents', sa.Integer),
        sa.column('expiry_date', sa.Date), sa.column('produced_at', sa.DateTime),
        sa.column('status', sa.String), sa.column('notes', sa.Text),
        sa.column('created_at', sa.DateTime),
    )
    transactions_table = sa.table(
        'inventory_transactions',
        sa.column('id', sa.String), sa.column('type', sa.String), sa.column('quantity', sa.Integer),
        sa.column('product_id', sa.String), sa.column('batch_id', sa.String),
        sa.column('reference_type', sa.String), sa.column('reference_id', sa.String),
        sa.column('reason', sa.Text), sa.column('created_by', sa.String),
        sa.column('created_at', sa.DateTime),
    )

    inventory_rows, batch_rows, transaction_rows = [], [], []
    for product_id, stock_quantity in existing_products:
        quantity = stock_quantity or 0
        batch_id = str(uuid.uuid4())

        inventory_rows.append({
            "id": str(uuid.uuid4()),
            "product_id": product_id,
            "on_hand": quantity,
            "reserved": 0,
            "reorder_level": 10,
        })
        batch_rows.append({
            "id": batch_id,
            "product_id": product_id,
            "batch_number": f"LEGACY-{product_id[:8]}",
            "quantity_produced": quantity,
            "quantity_remaining": quantity,
            "unit_cost_cents": None,
            "expiry_date": None,
            "produced_at": now,
            "status": "active",
            "notes": "Backfilled from legacy Product.stock_quantity.",
            "created_at": now,
        })
        transaction_rows.append({
            "id": str(uuid.uuid4()),
            "type": "PRODUCTION_RECEIPT",
            "quantity": quantity,
            "product_id": product_id,
            "batch_id": batch_id,
            "reference_type": None,
            "reference_id": None,
            "reason": "Backfilled from legacy Product.stock_quantity.",
            "created_by": None,
            "created_at": now,
        })

    if inventory_rows:
        op.bulk_insert(inventory_table, inventory_rows)
        op.bulk_insert(batches_table, batch_rows)
        op.bulk_insert(transactions_table, transaction_rows)

    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_column('stock_quantity')


def downgrade():
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.add_column(sa.Column('stock_quantity', sa.Integer(), nullable=False, server_default='0'))

    connection = op.get_bind()
    connection.execute(sa.text(
        "UPDATE products SET stock_quantity = COALESCE("
        "(SELECT on_hand FROM inventory WHERE inventory.product_id = products.id), 0)"
    ))

    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.alter_column('stock_quantity', server_default=None)

    op.drop_table('inventory_reservations')
    op.drop_table('inventory_transactions')
    op.drop_table('inventory_batches')
    op.drop_table('inventory')
