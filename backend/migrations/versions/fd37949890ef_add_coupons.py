"""add coupons

Revision ID: fd37949890ef
Revises: fc2dafba970e
Create Date: 2026-09-19 02:32:02.348519

Purely additive -- new coupons table, a nullable coupon_id on carts, and
coupon_id/coupon_code_snapshot/discount_cents on orders (discount_cents
gets a server default so it backfills existing rows as 0, not null). No
backfill of existing rows' *content* needed since nothing about coupons
existed before this.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fd37949890ef'
down_revision = 'fc2dafba970e'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'coupons',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('code', sa.String(length=40), nullable=False),
        sa.Column('discount_type', sa.String(length=20), nullable=False),
        sa.Column('discount_value', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('used_count', sa.Integer(), nullable=False),
        sa.Column('first_order_only', sa.Boolean(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
    )

    with op.batch_alter_table('carts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('coupon_id', sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(None, 'coupons', ['coupon_id'], ['id'])

    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('coupon_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('coupon_code_snapshot', sa.String(length=40), nullable=True))
        batch_op.add_column(
            sa.Column('discount_cents', sa.Integer(), nullable=False, server_default='0')
        )
        batch_op.create_foreign_key(None, 'coupons', ['coupon_id'], ['id'])


def downgrade():
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_column('discount_cents')
        batch_op.drop_column('coupon_code_snapshot')
        batch_op.drop_column('coupon_id')

    with op.batch_alter_table('carts', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_column('coupon_id')

    op.drop_table('coupons')
