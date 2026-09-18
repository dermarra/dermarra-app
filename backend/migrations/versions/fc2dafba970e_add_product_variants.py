"""add product variants

Revision ID: fc2dafba970e
Revises: 189c5136da45
Create Date: 2026-09-18 05:23:55.824778

Product becomes a catalogue "family" (name, description, images, concern/
ingredient tags); each sellable size/SKU is now a ProductVariant, which
owns price_cents/currency and is what Inventory/InventoryBatch/
InventoryTransaction/InventoryReservation, CartItem, and RoutineStep key
off going forward. OrderItem keeps its existing product_id column
denormalized *alongside* a new variant_id, so order history still reads
correctly even if a variant is later deleted -- it's already
snapshot-priced (name_snapshot/unit_price_cents_snapshot), so no backfill
of historical pricing is needed there.

Every existing Product gets exactly one backfilled ProductVariant
(label="Standard", price/currency carried over from the product), so
nothing sells for 0 mid-migration, and every row in the five tables that
move from product_id to variant_id is re-pointed at that product's new
default variant before the old column is dropped -- same "backfill then
drop in the same migration" style as a9322b7ec397.
"""
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fc2dafba970e'
down_revision = '189c5136da45'
branch_labels = None
depends_on = None


def upgrade():
    # ---- 1. new product_variants table ----
    op.create_table(
        'product_variants',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('label', sa.String(length=60), nullable=False),
        sa.Column('sku', sa.String(length=60), nullable=False),
        sa.Column('price_cents', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sku'),
    )

    # ---- 2. backfill: one default variant per existing product ----
    connection = op.get_bind()
    products_table = sa.table(
        'products',
        sa.column('id', sa.String), sa.column('slug', sa.String),
        sa.column('price_cents', sa.Integer), sa.column('currency', sa.String),
    )
    existing_products = connection.execute(
        sa.select(products_table.c.id, products_table.c.slug,
                  products_table.c.price_cents, products_table.c.currency)
    ).fetchall()

    now = datetime.now(timezone.utc)
    variants_table = sa.table(
        'product_variants',
        sa.column('id', sa.String), sa.column('product_id', sa.String),
        sa.column('label', sa.String), sa.column('sku', sa.String),
        sa.column('price_cents', sa.Integer), sa.column('currency', sa.String),
        sa.column('is_active', sa.Boolean), sa.column('position', sa.Integer),
        sa.column('created_at', sa.DateTime),
    )

    variant_rows = []
    product_to_variant = {}
    for product_id, slug, price_cents, currency in existing_products:
        variant_id = str(uuid.uuid4())
        product_to_variant[product_id] = variant_id
        variant_rows.append({
            "id": variant_id,
            "product_id": product_id,
            "label": "Standard",
            "sku": f"{slug}-STD",
            "price_cents": price_cents,
            "currency": currency,
            "is_active": True,
            "position": 0,
            "created_at": now,
        })

    if variant_rows:
        op.bulk_insert(variants_table, variant_rows)

    # ---- 3. add variant_id (nullable) to every table that references a
    # product today, and backfill it from the map built above ----
    tables_needing_variant_id = (
        "cart_items", "inventory", "inventory_batches",
        "inventory_transactions", "inventory_reservations",
        "routine_steps", "order_items",
    )
    for table_name in tables_needing_variant_id:
        with op.batch_alter_table(table_name, schema=None) as batch_op:
            batch_op.add_column(sa.Column('variant_id', sa.String(length=36), nullable=True))

    for table_name in tables_needing_variant_id:
        shadow = sa.table(
            table_name,
            sa.column('product_id', sa.String), sa.column('variant_id', sa.String),
        )
        for product_id, variant_id in product_to_variant.items():
            connection.execute(
                shadow.update().where(shadow.c.product_id == product_id).values(variant_id=variant_id)
            )

    # ---- 4. inventory/inventory_batches/inventory_transactions/
    # inventory_reservations/routine_steps: variant_id is NOT NULL on the
    # final model (every row there always had a non-null product_id) ----
    for table_name in ("inventory", "inventory_batches", "inventory_transactions",
                       "inventory_reservations", "routine_steps"):
        with op.batch_alter_table(table_name, schema=None) as batch_op:
            batch_op.alter_column('variant_id', existing_type=sa.String(length=36), nullable=False)

    # ---- 5. swap constraints/FKs/indexes from product_id to variant_id,
    # then drop product_id, for every table except order_items (which
    # keeps product_id denormalized) ----
    with op.batch_alter_table('cart_items', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('cart_items_product_id_fkey'), type_='foreignkey')
        batch_op.create_foreign_key(None, 'product_variants', ['variant_id'], ['id'])
        batch_op.drop_column('product_id')

    with op.batch_alter_table('inventory', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('inventory_product_id_key'), type_='unique')
        batch_op.create_unique_constraint(None, ['variant_id'])
        batch_op.drop_constraint(batch_op.f('inventory_product_id_fkey'), type_='foreignkey')
        batch_op.create_foreign_key(None, 'product_variants', ['variant_id'], ['id'])
        batch_op.drop_column('product_id')

    with op.batch_alter_table('inventory_batches', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('uq_batch_product_number'), type_='unique')
        batch_op.create_unique_constraint('uq_batch_variant_number', ['variant_id', 'batch_number'])
        batch_op.drop_constraint(batch_op.f('inventory_batches_product_id_fkey'), type_='foreignkey')
        batch_op.create_foreign_key(None, 'product_variants', ['variant_id'], ['id'])
        batch_op.drop_column('product_id')

    with op.batch_alter_table('inventory_transactions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_inventory_transactions_batch_id'))
        batch_op.drop_index(batch_op.f('ix_inventory_transactions_product_id'))
        batch_op.drop_index(batch_op.f('ix_inventory_transactions_reference'))
        batch_op.drop_constraint(batch_op.f('inventory_transactions_product_id_fkey'), type_='foreignkey')
        batch_op.create_foreign_key(None, 'product_variants', ['variant_id'], ['id'])
        batch_op.drop_column('product_id')
        # re-declare every index this table had before -- batch mode does
        # not re-emit unrelated indexes automatically once any constraint
        # on the table is touched.
        batch_op.create_index('ix_inventory_transactions_batch_id', ['batch_id'])
        batch_op.create_index('ix_inventory_transactions_variant_id', ['variant_id'])
        batch_op.create_index('ix_inventory_transactions_reference', ['reference_type', 'reference_id'])

    with op.batch_alter_table('inventory_reservations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_inventory_reservations_order_id'))
        batch_op.drop_index(batch_op.f('ix_inventory_reservations_status'))
        batch_op.drop_constraint(batch_op.f('inventory_reservations_product_id_fkey'), type_='foreignkey')
        batch_op.create_foreign_key(None, 'product_variants', ['variant_id'], ['id'])
        batch_op.drop_column('product_id')
        batch_op.create_index('ix_inventory_reservations_order_id', ['order_id'])
        batch_op.create_index('ix_inventory_reservations_status', ['status'])

    with op.batch_alter_table('routine_steps', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('routine_steps_product_id_fkey'), type_='foreignkey')
        batch_op.create_foreign_key(None, 'product_variants', ['variant_id'], ['id'])
        batch_op.drop_column('product_id')

    # order_items: variant_id is additive, product_id stays (denormalized).
    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.create_foreign_key(None, 'product_variants', ['variant_id'], ['id'])

    # ---- 6. price now lives on ProductVariant, not Product ----
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_column('currency')
        batch_op.drop_column('price_cents')


def downgrade():
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.add_column(sa.Column('price_cents', sa.INTEGER(), autoincrement=False, nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('currency', sa.VARCHAR(length=3), autoincrement=False, nullable=False, server_default='KES'))

    connection = op.get_bind()
    connection.execute(sa.text(
        "UPDATE products SET price_cents = COALESCE("
        "(SELECT price_cents FROM product_variants WHERE product_variants.product_id = products.id "
        "ORDER BY position LIMIT 1), 0), "
        "currency = COALESCE("
        "(SELECT currency FROM product_variants WHERE product_variants.product_id = products.id "
        "ORDER BY position LIMIT 1), 'KES')"
    ))
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.alter_column('price_cents', server_default=None)
        batch_op.alter_column('currency', server_default=None)

    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_column('variant_id')

    with op.batch_alter_table('routine_steps', schema=None) as batch_op:
        batch_op.add_column(sa.Column('product_id', sa.VARCHAR(length=36), autoincrement=False, nullable=True))
    connection.execute(sa.text(
        "UPDATE routine_steps SET product_id = "
        "(SELECT product_id FROM product_variants WHERE product_variants.id = routine_steps.variant_id)"
    ))
    with op.batch_alter_table('routine_steps', schema=None) as batch_op:
        batch_op.alter_column('product_id', existing_type=sa.String(length=36), nullable=False)
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.create_foreign_key(batch_op.f('routine_steps_product_id_fkey'), 'products', ['product_id'], ['id'])
        batch_op.drop_column('variant_id')

    with op.batch_alter_table('inventory_reservations', schema=None) as batch_op:
        batch_op.drop_index('ix_inventory_reservations_order_id')
        batch_op.drop_index('ix_inventory_reservations_status')
        batch_op.add_column(sa.Column('product_id', sa.VARCHAR(length=36), autoincrement=False, nullable=True))
    connection.execute(sa.text(
        "UPDATE inventory_reservations SET product_id = "
        "(SELECT product_id FROM product_variants WHERE product_variants.id = inventory_reservations.variant_id)"
    ))
    with op.batch_alter_table('inventory_reservations', schema=None) as batch_op:
        batch_op.alter_column('product_id', existing_type=sa.String(length=36), nullable=False)
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.create_foreign_key(batch_op.f('inventory_reservations_product_id_fkey'), 'products', ['product_id'], ['id'])
        batch_op.create_index(batch_op.f('ix_inventory_reservations_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_inventory_reservations_order_id'), ['order_id'], unique=False)
        batch_op.drop_column('variant_id')

    with op.batch_alter_table('inventory_transactions', schema=None) as batch_op:
        batch_op.drop_index('ix_inventory_transactions_batch_id')
        batch_op.drop_index('ix_inventory_transactions_variant_id')
        batch_op.drop_index('ix_inventory_transactions_reference')
        batch_op.add_column(sa.Column('product_id', sa.VARCHAR(length=36), autoincrement=False, nullable=True))
    connection.execute(sa.text(
        "UPDATE inventory_transactions SET product_id = "
        "(SELECT product_id FROM product_variants WHERE product_variants.id = inventory_transactions.variant_id)"
    ))
    with op.batch_alter_table('inventory_transactions', schema=None) as batch_op:
        batch_op.alter_column('product_id', existing_type=sa.String(length=36), nullable=False)
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.create_foreign_key(batch_op.f('inventory_transactions_product_id_fkey'), 'products', ['product_id'], ['id'])
        batch_op.create_index(batch_op.f('ix_inventory_transactions_reference'), ['reference_type', 'reference_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inventory_transactions_product_id'), ['product_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inventory_transactions_batch_id'), ['batch_id'], unique=False)
        batch_op.drop_column('variant_id')

    with op.batch_alter_table('inventory_batches', schema=None) as batch_op:
        batch_op.add_column(sa.Column('product_id', sa.VARCHAR(length=36), autoincrement=False, nullable=True))
    connection.execute(sa.text(
        "UPDATE inventory_batches SET product_id = "
        "(SELECT product_id FROM product_variants WHERE product_variants.id = inventory_batches.variant_id)"
    ))
    with op.batch_alter_table('inventory_batches', schema=None) as batch_op:
        batch_op.alter_column('product_id', existing_type=sa.String(length=36), nullable=False)
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.create_foreign_key(batch_op.f('inventory_batches_product_id_fkey'), 'products', ['product_id'], ['id'])
        batch_op.drop_constraint('uq_batch_variant_number', type_='unique')
        batch_op.create_unique_constraint(batch_op.f('uq_batch_product_number'), ['product_id', 'batch_number'])
        batch_op.drop_column('variant_id')

    with op.batch_alter_table('inventory', schema=None) as batch_op:
        batch_op.add_column(sa.Column('product_id', sa.VARCHAR(length=36), autoincrement=False, nullable=True))
    connection.execute(sa.text(
        "UPDATE inventory SET product_id = "
        "(SELECT product_id FROM product_variants WHERE product_variants.id = inventory.variant_id)"
    ))
    with op.batch_alter_table('inventory', schema=None) as batch_op:
        batch_op.alter_column('product_id', existing_type=sa.String(length=36), nullable=False)
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.create_foreign_key(batch_op.f('inventory_product_id_fkey'), 'products', ['product_id'], ['id'])
        batch_op.drop_constraint(None, type_='unique')
        batch_op.create_unique_constraint(batch_op.f('inventory_product_id_key'), ['product_id'])
        batch_op.drop_column('variant_id')

    with op.batch_alter_table('cart_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('product_id', sa.VARCHAR(length=36), autoincrement=False, nullable=True))
    connection.execute(sa.text(
        "UPDATE cart_items SET product_id = "
        "(SELECT product_id FROM product_variants WHERE product_variants.id = cart_items.variant_id) "
        "WHERE variant_id IS NOT NULL"
    ))
    with op.batch_alter_table('cart_items', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.create_foreign_key(batch_op.f('cart_items_product_id_fkey'), 'products', ['product_id'], ['id'])
        batch_op.drop_column('variant_id')

    op.drop_table('product_variants')
