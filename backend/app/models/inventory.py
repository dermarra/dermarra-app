import uuid
from datetime import datetime, timezone

from app.extensions import db


class Inventory(db.Model):
    """The single source of truth for a product's stock level -- supersedes
    the old Product.stock_quantity column (dropped in the migration that
    introduced this table; existing quantities were backfilled here and
    into an initial InventoryBatch, not lost).

    `available` (on_hand - reserved) is computed, never stored, so it can
    never drift out of sync with the numbers it's derived from.
    """

    __tablename__ = "inventory"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = db.Column(db.String(36), db.ForeignKey("products.id"), nullable=False, unique=True)
    on_hand = db.Column(db.Integer, default=0, nullable=False)
    reserved = db.Column(db.Integer, default=0, nullable=False)
    reorder_level = db.Column(db.Integer, default=10, nullable=False)

    product = db.relationship("Product", backref=db.backref("inventory", uselist=False, lazy="joined"))

    @property
    def available(self):
        return self.on_hand - self.reserved

    def stock_status(self):
        if self.available <= 0:
            return "out_of_stock"
        if self.available <= self.reorder_level:
            return "low_stock"
        return "in_stock"

    def to_dict(self, include_admin_fields=False):
        data = {"product_id": self.product_id, "stock_status": self.stock_status()}
        if include_admin_fields:
            data.update({
                "on_hand": self.on_hand,
                "reserved": self.reserved,
                "available": self.available,
                "reorder_level": self.reorder_level,
            })
        return data


class InventoryBatch(db.Model):
    """One production run's worth of stock. Dermarra Skincare manufactures
    in-house -- there is no supplier/vendor concept here, `unit_cost_cents`
    is the internal per-unit production cost (ingredients + packaging +
    labor), and a batch is logged when a run finishes, not when goods
    arrive from a third party (see InventoryTransaction.PRODUCTION_RECEIPT).

    `expiry_date` is nullable: a product with no shelf-life concern still
    gets a real batch row, just with expiry_date=None. FEFO allocation
    orders `ORDER BY expiry_date ASC`, and Postgres sorts NULL last under
    ASC by default, so non-expiring batches are only drawn from once every
    dated batch is exhausted -- no special-casing needed in the query.
    """

    __tablename__ = "inventory_batches"

    STATUSES = ("active", "depleted", "expired", "recalled")

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = db.Column(db.String(36), db.ForeignKey("products.id"), nullable=False)
    batch_number = db.Column(db.String(60), nullable=False)
    quantity_produced = db.Column(db.Integer, nullable=False)
    quantity_remaining = db.Column(db.Integer, nullable=False)
    unit_cost_cents = db.Column(db.Integer, nullable=True)
    expiry_date = db.Column(db.Date, nullable=True)
    produced_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    status = db.Column(db.String(20), default="active", nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (db.UniqueConstraint("product_id", "batch_number", name="uq_batch_product_number"),)

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "batch_number": self.batch_number,
            "quantity_produced": self.quantity_produced,
            "quantity_remaining": self.quantity_remaining,
            "unit_cost_cents": self.unit_cost_cents,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "produced_at": self.produced_at.isoformat() if self.produced_at else None,
            "status": self.status,
            "notes": self.notes,
        }


class InventoryTransaction(db.Model):
    """An immutable audit row for every unit that ever entered or left a
    batch. Never edited after creation -- a mistake gets a correcting
    transaction (another row), not a rewrite of this one. `quantity` is
    signed: positive adds to the batch/on-hand total, negative subtracts.
    """

    __tablename__ = "inventory_transactions"

    TYPES = (
        "PRODUCTION_RECEIPT",  # a finished production run enters inventory
        "SALE",                # consumed by a paid order (FEFO-allocated)
        "RETURN",               # credited back, e.g. a paid order was cancelled
        "DAMAGE",
        "EXPIRY",
        "LOSS",
        "ADJUSTMENT",           # manual correction, e.g. a stocktake
        "SAMPLE",
        "PROMOTION",
        "INTERNAL_USE",
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    type = db.Column(db.String(20), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    product_id = db.Column(db.String(36), db.ForeignKey("products.id"), nullable=False)
    batch_id = db.Column(db.String(36), db.ForeignKey("inventory_batches.id"), nullable=False)
    reference_type = db.Column(db.String(30), nullable=True)
    reference_id = db.Column(db.String(36), nullable=True)
    reason = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "quantity": self.quantity,
            "product_id": self.product_id,
            "batch_id": self.batch_id,
            "reference_type": self.reference_type,
            "reference_id": self.reference_id,
            "reason": self.reason,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
        }


class InventoryReservation(db.Model):
    """A hold against Inventory.reserved for one (order_item, product) line,
    created at checkout and resolved one of three ways: CONSUMED (payment
    confirmed -- FEFO-allocated a batch, see InventoryTransaction SALE
    rows), RELEASED (payment failed/cancelled), or EXPIRED (nobody paid in
    time). `batch_id` is only set once allocation happens at consumption,
    and only reflects the *first* batch drawn from if FEFO had to split
    across more than one -- the InventoryTransaction rows are the
    authoritative record of a split allocation, this field is a display
    convenience.
    """

    __tablename__ = "inventory_reservations"

    STATUSES = ("active", "consumed", "released", "expired", "cancelled")

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = db.Column(db.String(36), db.ForeignKey("orders.id"), nullable=False)
    order_item_id = db.Column(db.String(36), db.ForeignKey("order_items.id"), nullable=False)
    product_id = db.Column(db.String(36), db.ForeignKey("products.id"), nullable=False)
    batch_id = db.Column(db.String(36), db.ForeignKey("inventory_batches.id"), nullable=True)
    quantity = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), default="active", nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    released_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "order_id": self.order_id,
            "order_item_id": self.order_item_id,
            "product_id": self.product_id,
            "batch_id": self.batch_id,
            "quantity": self.quantity,
            "status": self.status,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "released_at": self.released_at.isoformat() if self.released_at else None,
        }
