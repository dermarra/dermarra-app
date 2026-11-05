"""add order payment_failure_reason

Revision ID: 3c8e1f2a9b7d
Revises: fd37949890ef
Create Date: 2026-11-06 12:00:00

Purely additive -- one nullable column holding Safaricom's own ResultDesc
for the latest failed STK attempt (e.g. "Request Cancelled by user."), so
checkout and order pages can say *why* a payment failed instead of a
generic message. Nullable, no backfill: old orders simply have no reason
recorded. Safe to apply before the code that uses it is deployed (old code
never selects it).
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3c8e1f2a9b7d'
down_revision = 'fd37949890ef'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('orders', sa.Column('payment_failure_reason', sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column('orders', 'payment_failure_reason')
