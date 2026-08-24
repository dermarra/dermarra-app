"""add hero slides, wishlist, and ingredient cover photo

Revision ID: 189c5136da45
Revises: a9322b7ec397
Create Date: 2026-08-24 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '189c5136da45'
down_revision = 'a9322b7ec397'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('ingredients', schema=None) as batch_op:
        batch_op.add_column(sa.Column('cloudinary_public_id', sa.String(length=255), nullable=True))

    op.create_table(
        'hero_slides',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('eyebrow', sa.String(length=120), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('subtitle', sa.Text(), nullable=True),
        sa.Column('cloudinary_public_id', sa.String(length=255), nullable=True),
        sa.Column('cta_label', sa.String(length=60), nullable=True),
        sa.Column('cta_link', sa.String(length=255), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'wishlists',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )

    op.create_table(
        'wishlist_items',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('wishlist_id', sa.String(length=36), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['wishlist_id'], ['wishlists.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('wishlist_id', 'product_id', name='uq_wishlist_product'),
    )


def downgrade():
    op.drop_table('wishlist_items')
    op.drop_table('wishlists')
    op.drop_table('hero_slides')
    with op.batch_alter_table('ingredients', schema=None) as batch_op:
        batch_op.drop_column('cloudinary_public_id')
