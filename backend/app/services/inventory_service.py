"""Inventory management: reservations, FEFO consumption, production
receipts and manual adjustments, all backed by the InventoryTransaction
ledger. See app/models/inventory.py for the data model and the "why" of
each table.

Every function here assumes it's called inside an existing db.session
transaction and leaves the commit to the caller (matches the rest of this
codebase's route-owns-the-commit convention).
"""
from datetime import date, datetime, timedelta, timezone

from app.extensions import db
from app.models.inventory import Inventory, InventoryBatch, InventoryTransaction, InventoryReservation
from app.models.product import Product
from app.models.routine import Routine
from app.utils.order_lines import stock_lines

RESERVATION_TTL_MINUTES = 20

# Transaction types a human can pick for a manual adjustment. SALE,
# RETURN and PRODUCTION_RECEIPT are system-generated only (checkout/
# payment/cancel and record_production_run respectively) -- never
# creatable through the manual-adjustment endpoint.
MANUAL_ADJUSTMENT_TYPES = (
    "DAMAGE", "EXPIRY", "LOSS", "ADJUSTMENT", "SAMPLE", "PROMOTION", "INTERNAL_USE",
)
# All of these only ever remove stock -- the caller passes a positive
# count and this module applies the sign. ADJUSTMENT is the exception:
# it's a raw correction, so the caller states the signed delta directly.
_ALWAYS_NEGATIVE_TYPES = set(MANUAL_ADJUSTMENT_TYPES) - {"ADJUSTMENT"}


class InsufficientStockError(Exception):
    def __init__(self, shortages):
        self.shortages = shortages  # {product_name_or_id: available_quantity}
        super().__init__(f"insufficient stock: {shortages}")


class InventoryError(ValueError):
    """Raised for adjustment/receiving input errors (bad batch, negative
    result, missing reason, etc.) -- a 400, not a 5xx."""


def _get_or_create_inventory(product_id):
    """Locks (or creates + locks) a product's Inventory row. Always call
    this -- never query Inventory directly -- when you're about to change
    on_hand/reserved, so the row-level lock is actually held."""
    inv = Inventory.query.filter_by(product_id=product_id).with_for_update().first()
    if inv:
        return inv
    inv = Inventory(product_id=product_id, on_hand=0, reserved=0, reorder_level=10)
    db.session.add(inv)
    db.session.flush()
    return inv


def _lock_inventories_for(product_ids):
    """Locks every distinct product's Inventory row up front, in a fixed
    (sorted) order, so two transactions that both touch several of the
    same products can never deadlock against each other."""
    return {pid: _get_or_create_inventory(pid) for pid in sorted(set(product_ids))}


# ---------- Reservations ----------

def expire_stale_reservations():
    """Releases every ACTIVE reservation whose expires_at has passed.
    There's no background worker in this project (no Celery/APScheduler),
    so this is called lazily wherever reservations are touched, and is
    also exposed as an admin endpoint for an external cron to hit."""
    now = datetime.now(timezone.utc)
    stale = InventoryReservation.query.filter(
        InventoryReservation.status == "active",
        InventoryReservation.expires_at < now,
    ).all()
    if not stale:
        return 0

    _lock_inventories_for(r.product_id for r in stale)
    for reservation in stale:
        _apply_release(reservation, new_status="expired")
    return len(stale)


def _apply_release(reservation, new_status):
    inv = _get_or_create_inventory(reservation.product_id)
    inv.reserved = max(0, inv.reserved - reservation.quantity)
    reservation.status = new_status
    reservation.released_at = datetime.now(timezone.utc)


def reserve_stock_for_order(order):
    """Places a hold on stock for everything an order needs -- one
    InventoryReservation per (order_item, product) line. Raises
    InsufficientStockError (nothing written) if any product can't be
    fully covered; caller commits on success.

    Concurrency: locks every distinct product's Inventory row (FOR
    UPDATE, fixed product-id order) before checking any of them, so two
    concurrent checkouts racing for the last unit can't both succeed --
    the second one blocks until the first commits or rolls back, then
    sees the updated `reserved` total.
    """
    expire_stale_reservations()

    lines = list(_order_lines(order))
    needed_by_product = {}
    for _, product_row, qty in lines:
        needed_by_product[product_row.id] = needed_by_product.get(product_row.id, 0) + qty

    inventories = _lock_inventories_for(needed_by_product.keys())

    shortages = {
        pid: inventories[pid].available
        for pid, needed in needed_by_product.items()
        if inventories[pid].available < needed
    }
    if shortages:
        names = {p.id: p.name for p in Product.query.filter(Product.id.in_(shortages)).all()}
        raise InsufficientStockError({names.get(pid, pid): avail for pid, avail in shortages.items()})

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESERVATION_TTL_MINUTES)
    reservations = []
    for order_item, product_row, qty in lines:
        inventories[product_row.id].reserved += qty
        reservation = InventoryReservation(
            order_id=order.id,
            order_item_id=order_item.id,
            product_id=product_row.id,
            quantity=qty,
            status="active",
            expires_at=expires_at,
        )
        db.session.add(reservation)
        reservations.append(reservation)
    return reservations


def _order_lines(order):
    for order_item in order.items:
        product = Product.query.get(order_item.product_id) if order_item.product_id else None
        routine = Routine.query.get(order_item.routine_id) if order_item.routine_id else None
        for product_row, needed_qty in stock_lines(product, routine, order_item.quantity):
            yield order_item, product_row, needed_qty


def release_reservations_for_order(order):
    """Releases every still-ACTIVE reservation on an order (payment
    failed, or the customer/admin cancelled before payment consumed
    them). No-op if there's nothing active left -- safe to call more than
    once for the same order."""
    reservations = InventoryReservation.query.filter_by(order_id=order.id, status="active").all()
    if not reservations:
        return []
    _lock_inventories_for(r.product_id for r in reservations)
    for reservation in reservations:
        _apply_release(reservation, new_status="released")
    return reservations


def consume_reservations_for_order(order, created_by=None):
    """Called once payment is confirmed. FEFO-allocates each ACTIVE
    reservation on this order against InventoryBatch rows (earliest
    expiry_date first; non-expiring batches sort last), writes one SALE
    transaction per batch drawn from, and marks the reservation CONSUMED.

    Idempotent: if there are no ACTIVE reservations left for this order
    (e.g. a duplicate M-Pesa callback for an order already marked paid),
    this is a no-op -- callers are expected to also gate on order.status
    the way payments.py already does, this is defense in depth.
    """
    reservations = InventoryReservation.query.filter_by(order_id=order.id, status="active").all()
    if not reservations:
        return []

    inventories = _lock_inventories_for(r.product_id for r in reservations)
    today = date.today()
    transactions = []

    for reservation in reservations:
        remaining = reservation.quantity
        batches = (
            InventoryBatch.query
            .filter(
                InventoryBatch.product_id == reservation.product_id,
                InventoryBatch.status == "active",
                InventoryBatch.quantity_remaining > 0,
                db.or_(InventoryBatch.expiry_date.is_(None), InventoryBatch.expiry_date >= today),
            )
            .order_by(InventoryBatch.expiry_date.asc())
            .with_for_update()
            .all()
        )

        first_batch = None
        for batch in batches:
            if remaining <= 0:
                break
            draw = min(batch.quantity_remaining, remaining)
            batch.quantity_remaining -= draw
            if batch.quantity_remaining == 0:
                batch.status = "depleted"
            remaining -= draw
            first_batch = first_batch or batch

            txn = InventoryTransaction(
                type="SALE",
                quantity=-draw,
                product_id=reservation.product_id,
                batch_id=batch.id,
                reference_type="order_item",
                reference_id=reservation.order_item_id,
                reason=f"Order {order.id}",
                created_by=created_by,
            )
            db.session.add(txn)
            transactions.append(txn)

        if remaining > 0:
            # The reservation held `reserved` against aggregate available
            # stock, but there wasn't enough *allocatable* (non-expired,
            # active) batch quantity to actually fulfill it -- e.g. a
            # batch expired between reservation and payment. Never
            # silently short-ship: surface it instead of leaving on_hand/
            # reserved inconsistent.
            raise InsufficientStockError({reservation.product_id: -remaining})

        inv = inventories[reservation.product_id]
        inv.on_hand -= reservation.quantity
        inv.reserved = max(0, inv.reserved - reservation.quantity)
        reservation.status = "consumed"
        reservation.batch_id = first_batch.id if first_batch else None

    return transactions


def restock_order(order, created_by=None):
    """Reverses consume_reservations_for_order for a paid/processing/
    shipped order an admin cancels. Credits back exactly the batches the
    original SALE transactions drew from (one RETURN transaction per
    original SALE row), so a FEFO split allocation reverses correctly.
    No-op if this order never actually consumed stock (e.g. it was
    cancelled before payment, in which case release_reservations_for_order
    already handled it)."""
    order_item_ids = [item.id for item in order.items]
    if not order_item_ids:
        return []

    sale_txns = InventoryTransaction.query.filter(
        InventoryTransaction.type == "SALE",
        InventoryTransaction.reference_type == "order_item",
        InventoryTransaction.reference_id.in_(order_item_ids),
    ).all()
    if not sale_txns:
        return []

    inventories = _lock_inventories_for(t.product_id for t in sale_txns)
    batch_ids = sorted({t.batch_id for t in sale_txns})
    batches = {
        b.id: b
        for b in InventoryBatch.query.filter(InventoryBatch.id.in_(batch_ids)).with_for_update().all()
    }

    transactions = []
    for sale in sale_txns:
        qty = -sale.quantity  # sale.quantity was recorded negative
        batch = batches[sale.batch_id]
        batch.quantity_remaining += qty
        if batch.status == "depleted" and batch.quantity_remaining > 0:
            batch.status = "active"

        inventories[sale.product_id].on_hand += qty

        txn = InventoryTransaction(
            type="RETURN",
            quantity=qty,
            product_id=sale.product_id,
            batch_id=batch.id,
            reference_type="order_item",
            reference_id=sale.reference_id,
            reason=f"Order {order.id} cancelled",
            created_by=created_by,
        )
        db.session.add(txn)
        transactions.append(txn)

    return transactions


# ---------- Production receipts & manual adjustments ----------

def record_production_run(
    product_id, *, batch_number, quantity_produced, unit_cost_cents=None,
    expiry_date=None, produced_at=None, notes=None, created_by=None,
):
    """Logs a finished in-house production run into inventory: creates the
    batch and a PRODUCTION_RECEIPT transaction, and bumps on_hand."""
    if not batch_number:
        raise InventoryError("batch_number is required")
    if not isinstance(quantity_produced, int) or quantity_produced <= 0:
        raise InventoryError("quantity_produced must be a positive integer")

    inv = _get_or_create_inventory(product_id)

    batch = InventoryBatch(
        product_id=product_id,
        batch_number=batch_number,
        quantity_produced=quantity_produced,
        quantity_remaining=quantity_produced,
        unit_cost_cents=unit_cost_cents,
        expiry_date=expiry_date,
        produced_at=produced_at or datetime.now(timezone.utc),
        status="active",
        notes=notes,
    )
    db.session.add(batch)
    db.session.flush()

    inv.on_hand += quantity_produced

    txn = InventoryTransaction(
        type="PRODUCTION_RECEIPT",
        quantity=quantity_produced,
        product_id=product_id,
        batch_id=batch.id,
        reference_type=None,
        reference_id=None,
        reason=notes,
        created_by=created_by,
    )
    db.session.add(txn)
    return batch, txn


def adjust_stock(product_id, *, batch_id, transaction_type, quantity, reason, created_by=None):
    """A manual correction against one batch -- DAMAGE/EXPIRY/LOSS/SAMPLE/
    PROMOTION/INTERNAL_USE (`quantity` a positive count, this function
    applies the sign) or ADJUSTMENT (`quantity` a signed delta the caller
    states directly, e.g. a stocktake correction). Always requires a
    reason -- this is the one place a human can move stock outside the
    order/production flow, so the ledger row has to explain why."""
    if transaction_type not in MANUAL_ADJUSTMENT_TYPES:
        raise InventoryError(f"{transaction_type} is not a valid manual adjustment type")
    if not reason:
        raise InventoryError("reason is required for a manual adjustment")
    if not isinstance(quantity, int) or quantity == 0:
        raise InventoryError("quantity must be a non-zero integer")

    batch = (
        InventoryBatch.query
        .filter_by(id=batch_id, product_id=product_id)
        .with_for_update()
        .first()
    )
    if not batch:
        raise InventoryError("batch not found for this product")

    signed_qty = quantity if transaction_type == "ADJUSTMENT" else -abs(quantity)

    new_remaining = batch.quantity_remaining + signed_qty
    if new_remaining < 0:
        raise InventoryError("this adjustment would take the batch's remaining quantity below zero")

    inv = _get_or_create_inventory(product_id)
    new_on_hand = inv.on_hand + signed_qty
    if new_on_hand < 0:
        raise InventoryError("this adjustment would take on-hand stock below zero")

    batch.quantity_remaining = new_remaining
    if batch.quantity_remaining == 0 and batch.status == "active":
        batch.status = "depleted"
    elif batch.quantity_remaining > 0 and batch.status == "depleted":
        batch.status = "active"

    inv.on_hand = new_on_hand

    txn = InventoryTransaction(
        type=transaction_type,
        quantity=signed_qty,
        product_id=product_id,
        batch_id=batch.id,
        reference_type=None,
        reference_id=None,
        reason=reason,
        created_by=created_by,
    )
    db.session.add(txn)
    return txn


# ---------- Reporting ----------

def inventory_summary():
    """Dashboard/admin summary: counts behind the "total/low/out/expiring"
    cards. Active products only -- a discontinued product's stock isn't
    actionable the same way."""
    active_product_ids = [p.id for p in Product.query.filter_by(is_active=True).with_entities(Product.id).all()]
    total_products = len(active_product_ids)

    invs = Inventory.query.filter(Inventory.product_id.in_(active_product_ids)).all() if active_product_ids else []
    low_stock = sum(1 for inv in invs if inv.stock_status() == "low_stock")
    out_of_stock = sum(1 for inv in invs if inv.stock_status() == "out_of_stock")

    soon = date.today() + timedelta(days=30)
    expiring_soon = InventoryBatch.query.filter(
        InventoryBatch.status == "active",
        InventoryBatch.expiry_date.isnot(None),
        InventoryBatch.expiry_date <= soon,
    ).count()

    return {
        "total_products": total_products,
        "low_stock_count": low_stock,
        "out_of_stock_count": out_of_stock,
        "expiring_soon_count": expiring_soon,
    }
