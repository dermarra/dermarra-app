"""Priority coverage per the inventory management build: reservation
concurrency (real Postgres row locking, not app-level check-then-write),
FEFO allocation, and idempotent payment consumption. A few smaller
correctness tests are included as time allowed.

See conftest.py for why these hit the real dev DB instead of a sqlite/
transactional test DB -- there isn't one configured in this project yet.
"""
import threading
import time
from datetime import date, timedelta

from app.extensions import db
from app.models.inventory import Inventory, InventoryBatch
from app.models.order import Order
from app.services import inventory_service
from app.services.inventory_service import InsufficientStockError, InventoryError


def _inv(product_id):
    return Inventory.query.filter_by(product_id=product_id).first()


# ---------- Reservation concurrency ----------

def test_reservation_concurrency_last_unit_never_double_books(app, make_product, make_order):
    """Two 'customers' race to reserve the same last unit. The second
    reservation attempt must block on the first's row lock (proven by
    timing it), and must fail once it does proceed -- available inventory
    must never go negative and never be double-reserved."""
    product = make_product(name="__TEST__ concurrency")
    inventory_service.record_production_run(product.id, batch_number="B1", quantity_produced=1)
    db.session.commit()

    order_a = make_order(product, quantity=1)
    order_b = make_order(product, quantity=1)
    db.session.commit()
    order_a_id, order_b_id = order_a.id, order_b.id

    results = {}
    b_may_start = threading.Event()

    def run_a():
        with app.app_context():
            order = Order.query.get(order_a_id)
            inventory_service.reserve_stock_for_order(order)
            # Hold the row lock open (uncommitted) so B's FOR UPDATE has
            # something real to block on, not just a timing coincidence.
            b_may_start.set()
            time.sleep(1.0)
            db.session.commit()
            results["a"] = "ok"

    def run_b():
        with app.app_context():
            b_may_start.wait(timeout=5)
            start = time.monotonic()
            order = Order.query.get(order_b_id)
            try:
                inventory_service.reserve_stock_for_order(order)
                db.session.commit()
                results["b"] = "ok"
            except InsufficientStockError:
                db.session.rollback()
                results["b"] = "insufficient"
            results["b_waited"] = time.monotonic() - start

    t_a = threading.Thread(target=run_a)
    t_b = threading.Thread(target=run_b)
    t_a.start()
    t_b.start()
    t_a.join(timeout=10)
    t_b.join(timeout=10)

    assert results.get("a") == "ok"
    assert results.get("b") == "insufficient"
    # If B didn't actually block on A's lock, it would have raced through
    # and found (incorrectly) available stock in well under a second.
    assert results["b_waited"] >= 0.9, "B did not appear to block on A's row lock"

    inv = _inv(product.id)
    assert inv.on_hand == 1
    assert inv.reserved == 1
    assert inv.available == 0


# ---------- FEFO allocation ----------

def test_fefo_allocates_earliest_expiry_first_and_splits_across_batches(app, make_product, make_order):
    product = make_product(name="__TEST__ fefo")
    near_batch, _ = inventory_service.record_production_run(
        product.id, batch_number="NEAR", quantity_produced=3, expiry_date=date.today() + timedelta(days=5)
    )
    far_batch, _ = inventory_service.record_production_run(
        product.id, batch_number="NON-EXPIRING", quantity_produced=10, expiry_date=None
    )
    db.session.commit()

    order = make_order(product, quantity=5)
    db.session.commit()
    inventory_service.reserve_stock_for_order(order)
    db.session.commit()
    transactions = inventory_service.consume_reservations_for_order(order)
    db.session.commit()

    drawn = {t.batch_id: -t.quantity for t in transactions}
    assert drawn == {near_batch.id: 3, far_batch.id: 2}, "should exhaust the soonest-expiring batch before the non-expiring one"

    assert InventoryBatch.query.get(near_batch.id).status == "depleted"
    assert InventoryBatch.query.get(far_batch.id).quantity_remaining == 8


def test_fefo_never_allocates_an_expired_batch(app, make_product, make_order):
    product = make_product(name="__TEST__ fefo-expired")
    expired_batch, _ = inventory_service.record_production_run(
        product.id, batch_number="EXPIRED", quantity_produced=5, expiry_date=date.today() - timedelta(days=1)
    )
    fresh_batch, _ = inventory_service.record_production_run(
        product.id, batch_number="FRESH", quantity_produced=5, expiry_date=date.today() + timedelta(days=30)
    )
    db.session.commit()

    order = make_order(product, quantity=2)
    db.session.commit()
    inventory_service.reserve_stock_for_order(order)
    db.session.commit()
    transactions = inventory_service.consume_reservations_for_order(order)
    db.session.commit()

    drawn_batch_ids = {t.batch_id for t in transactions}
    assert expired_batch.id not in drawn_batch_ids
    assert drawn_batch_ids == {fresh_batch.id}
    assert InventoryBatch.query.get(expired_batch.id).quantity_remaining == 5  # untouched


# ---------- Idempotent payment consumption ----------

def test_consume_reservations_is_idempotent(app, make_product, make_order):
    """Simulates the M-Pesa callback firing twice for the same order --
    the second call must be a no-op, not a double deduction."""
    product = make_product(name="__TEST__ idempotent")
    inventory_service.record_production_run(product.id, batch_number="B1", quantity_produced=10)
    db.session.commit()

    order = make_order(product, quantity=3)
    db.session.commit()
    inventory_service.reserve_stock_for_order(order)
    db.session.commit()

    first_pass = inventory_service.consume_reservations_for_order(order)
    db.session.commit()
    assert len(first_pass) == 1
    assert _inv(product.id).on_hand == 7

    second_pass = inventory_service.consume_reservations_for_order(order)
    db.session.commit()
    assert second_pass == []
    assert _inv(product.id).on_hand == 7, "a duplicate callback must not deduct stock twice"


# ---------- Reservation release & restock ----------

def test_release_frees_the_hold_without_touching_on_hand(app, make_product, make_order):
    product = make_product(name="__TEST__ release")
    inventory_service.record_production_run(product.id, batch_number="B1", quantity_produced=5)
    db.session.commit()

    order = make_order(product, quantity=2)
    db.session.commit()
    inventory_service.reserve_stock_for_order(order)
    db.session.commit()
    assert _inv(product.id).reserved == 2

    inventory_service.release_reservations_for_order(order)
    db.session.commit()

    inv = _inv(product.id)
    assert inv.reserved == 0
    assert inv.on_hand == 5  # never left on_hand -- it was only ever reserved, not consumed


def test_restock_order_reverses_the_exact_batches_a_sale_drew_from(app, make_product, make_order):
    product = make_product(name="__TEST__ restock")
    near, _ = inventory_service.record_production_run(
        product.id, batch_number="NEAR", quantity_produced=2, expiry_date=date.today() + timedelta(days=5)
    )
    far, _ = inventory_service.record_production_run(product.id, batch_number="FAR", quantity_produced=10)
    db.session.commit()

    order = make_order(product, quantity=5)  # spans both batches: 2 from NEAR, 3 from FAR
    db.session.commit()
    inventory_service.reserve_stock_for_order(order)
    db.session.commit()
    inventory_service.consume_reservations_for_order(order)
    db.session.commit()
    assert InventoryBatch.query.get(near.id).quantity_remaining == 0
    assert InventoryBatch.query.get(far.id).quantity_remaining == 7

    inventory_service.restock_order(order)
    db.session.commit()

    assert InventoryBatch.query.get(near.id).quantity_remaining == 2
    assert InventoryBatch.query.get(near.id).status == "active"
    assert InventoryBatch.query.get(far.id).quantity_remaining == 10
    assert _inv(product.id).on_hand == 12


# ---------- Manual adjustment validation ----------

def test_adjust_stock_requires_a_reason(app, make_product):
    product = make_product(name="__TEST__ adjust-reason")
    batch, _ = inventory_service.record_production_run(product.id, batch_number="B1", quantity_produced=5)
    db.session.commit()

    try:
        inventory_service.adjust_stock(
            product.id, batch_id=batch.id, transaction_type="DAMAGE", quantity=1, reason="",
        )
        assert False, "expected an InventoryError"
    except InventoryError:
        db.session.rollback()


def test_adjust_stock_rejects_going_below_zero(app, make_product):
    product = make_product(name="__TEST__ adjust-negative")
    batch, _ = inventory_service.record_production_run(product.id, batch_number="B1", quantity_produced=2)
    db.session.commit()

    try:
        inventory_service.adjust_stock(
            product.id, batch_id=batch.id, transaction_type="DAMAGE", quantity=5, reason="too many",
        )
        assert False, "expected an InventoryError"
    except InventoryError:
        db.session.rollback()

    assert InventoryBatch.query.get(batch.id).quantity_remaining == 2
