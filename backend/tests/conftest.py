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
from app.models.coupon import Coupon
from app.models.inventory import Inventory, InventoryBatch, InventoryReservation, InventoryTransaction
from app.models.order import Order, OrderItem
from app.models.product import Product, ProductVariant
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
def make_variant(app):
    """Factory fixture: make_variant(name="...") -> ProductVariant, with a
    backing Product family row and an empty Inventory row already attached
    (matching what the admin "create variant" endpoint does). Stock/price
    live on the variant, not the product -- see the ProductVariant
    migration. Everything it touches is deleted, in FK-safe order, on
    teardown."""
    created = []  # list of (variant_id, product_id)

    def _make(name="__TEST__ product", reorder_level=10, slug=None, price_cents=1000):
        import uuid
        suffix = uuid.uuid4().hex[:8]
        product = Product(
            name=name,
            slug=slug or f"__test__-{suffix}",
            step_type="serum",
        )
        db.session.add(product)
        db.session.flush()
        variant = ProductVariant(
            product_id=product.id,
            label="Standard",
            sku=f"__test__-{suffix}-STD",
            price_cents=price_cents,
        )
        db.session.add(variant)
        db.session.flush()
        db.session.add(Inventory(variant_id=variant.id, reorder_level=reorder_level))
        db.session.commit()
        created.append((variant.id, product.id))
        return variant

    yield _make

    for variant_id, product_id in created:
        InventoryReservation.query.filter_by(variant_id=variant_id).delete()
        order_item_ids = [
            row.id for row in OrderItem.query.filter_by(variant_id=variant_id).all()
        ]
        order_ids = {
            row.order_id for row in OrderItem.query.filter(OrderItem.id.in_(order_item_ids)).all()
        } if order_item_ids else set()
        OrderItem.query.filter_by(variant_id=variant_id).delete()
        for order_id in order_ids:
            Order.query.filter_by(id=order_id).delete()
        InventoryTransaction.query.filter_by(variant_id=variant_id).delete()
        InventoryBatch.query.filter_by(variant_id=variant_id).delete()
        Inventory.query.filter_by(variant_id=variant_id).delete()
        ProductVariant.query.filter_by(id=variant_id).delete()
        Product.query.filter_by(id=product_id).delete()
    db.session.commit()


@pytest.fixture
def make_order(app, test_user):
    """Factory fixture: make_order(variant, quantity) -> Order (flushed,
    has an id and its OrderItem has an id, not committed). Caller is
    responsible for committing/rolling back; cleanup happens via the
    owning make_variant fixture since OrderItem.variant_id ties it back."""
    def _make(variant, quantity=1):
        order = Order(
            user_id=test_user.id,
            status="pending",
            subtotal_cents=variant.price_cents * quantity,
            total_cents=variant.price_cents * quantity,
            shipping_name="__TEST__", shipping_address_line1="__TEST__",
            shipping_city="__TEST__", shipping_country="__TEST__",
            shipping_postal_code="00000", shipping_phone="0700000000",
        )
        item = OrderItem(
            product_id=variant.product_id, variant_id=variant.id,
            name_snapshot=f"{variant.product.name} — {variant.label}",
            unit_price_cents_snapshot=variant.price_cents, quantity=quantity,
        )
        order.items.append(item)
        db.session.add(order)
        db.session.flush()
        return order

    return _make


@pytest.fixture
def make_coupon(app):
    """Factory fixture: make_coupon(**overrides) -> Coupon. Teardown is
    self-contained (doesn't rely on ordering relative to make_variant's
    teardown): deletes any Order still referencing this coupon before
    deleting the coupon row itself, since Order.coupon_id has no
    ON DELETE CASCADE."""
    created = []

    def _make(code=None, discount_type="percent", discount_value=10, **overrides):
        import uuid
        coupon = Coupon(
            code=code or f"__TEST__{uuid.uuid4().hex[:8].upper()}",
            discount_type=discount_type,
            discount_value=discount_value,
            **overrides,
        )
        db.session.add(coupon)
        db.session.commit()
        created.append(coupon.id)
        return coupon

    yield _make

    for coupon_id in created:
        order_ids = [row.id for row in Order.query.filter_by(coupon_id=coupon_id).all()]
        if order_ids:
            OrderItem.query.filter(OrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)
            Order.query.filter(Order.id.in_(order_ids)).delete(synchronize_session=False)
        Coupon.query.filter_by(id=coupon_id).delete()
    db.session.commit()
