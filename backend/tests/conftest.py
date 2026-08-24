"""There's no separate test database configured for this project (see
CLAUDE.md's Supabase connection-pooling gotcha and app/config.py -- one
DATABASE_URL, no TESTING config, no sqlite fallback). These are
integration tests against the real dev DB, kept disposable through
explicit fixture teardown rather than a rollback-only transaction --
the concurrency test in particular needs real committed rows visible
across separate threads/connections, which a wrapped-and-rolled-back
transaction can't give us.

Every row these tests create is tagged with a `__TEST__` prefix/slug so
it's obvious at a glance in the DB if a teardown ever gets interrupted.
"""
import pytest

from app import create_app
from app.extensions import db
from app.models.inventory import Inventory, InventoryBatch, InventoryReservation, InventoryTransaction
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.user import User


@pytest.fixture(scope="session")
def _flask_app():
    """One Flask app (and one SQLAlchemy engine/connection pool) for the
    whole test session. Building a fresh create_app() per test would build
    a fresh engine per test too -- their pools are never explicitly
    disposed, and left to overlap for however long GC takes, which is
    exactly the kind of connection-count pressure CLAUDE.md's Supabase
    pooling gotcha warns about (this hit it in practice: the suite was
    intermittently failing mid-run before this was session-scoped)."""
    application = create_app()
    yield application
    with application.app_context():
        db.engine.dispose()


@pytest.fixture
def app(_flask_app):
    ctx = _flask_app.app_context()
    ctx.push()
    yield _flask_app
    ctx.pop()


@pytest.fixture
def test_user(app):
    user = User.query.first()
    if not user:
        pytest.skip("no user exists in the dev DB to attach test orders to")
    return user


@pytest.fixture
def make_product(app):
    """Factory fixture: make_product(name="...") -> Product, with an empty
    Inventory row already attached (matching what create_product does).
    Everything it touches is deleted, in FK-safe order, on teardown."""
    created = []

    def _make(name="__TEST__ product", reorder_level=10, slug=None):
        import uuid
        product = Product(
            name=name,
            slug=slug or f"__test__-{uuid.uuid4().hex[:8]}",
            step_type="serum",
            price_cents=1000,
        )
        db.session.add(product)
        db.session.flush()
        db.session.add(Inventory(product_id=product.id, reorder_level=reorder_level))
        db.session.commit()
        created.append(product.id)
        return product

    yield _make

    for product_id in created:
        InventoryReservation.query.filter_by(product_id=product_id).delete()
        order_item_ids = [
            row.id for row in OrderItem.query.filter_by(product_id=product_id).all()
        ]
        order_ids = {
            row.order_id for row in OrderItem.query.filter(OrderItem.id.in_(order_item_ids)).all()
        } if order_item_ids else set()
        OrderItem.query.filter_by(product_id=product_id).delete()
        for order_id in order_ids:
            Order.query.filter_by(id=order_id).delete()
        InventoryTransaction.query.filter_by(product_id=product_id).delete()
        InventoryBatch.query.filter_by(product_id=product_id).delete()
        Inventory.query.filter_by(product_id=product_id).delete()
        Product.query.filter_by(id=product_id).delete()
    db.session.commit()


@pytest.fixture
def make_order(app, test_user):
    """Factory fixture: make_order(product, quantity) -> Order (flushed,
    has an id and its OrderItem has an id, not committed). Caller is
    responsible for committing/rolling back; cleanup happens via the
    owning make_product fixture since OrderItem.product_id ties it back."""
    def _make(product, quantity=1):
        order = Order(
            user_id=test_user.id,
            status="pending",
            subtotal_cents=product.price_cents * quantity,
            total_cents=product.price_cents * quantity,
            shipping_name="__TEST__", shipping_address_line1="__TEST__",
            shipping_city="__TEST__", shipping_country="__TEST__",
            shipping_postal_code="00000", shipping_phone="0700000000",
        )
        item = OrderItem(
            product_id=product.id, name_snapshot=product.name,
            unit_price_cents_snapshot=product.price_cents, quantity=quantity,
        )
        order.items.append(item)
        db.session.add(order)
        db.session.flush()
        return order

    return _make
