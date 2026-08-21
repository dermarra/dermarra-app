from app.models.product import Product
from app.models.routine import Routine


def stock_lines(product, routine, quantity):
    """Expands a cart/order line into the (product, quantity_needed) pairs
    it actually consumes -- a routine needs `quantity` units of every
    product in it, not just one."""
    if product:
        return [(product, quantity)]
    return [(step.product, quantity) for step in routine.steps]


def _order_stock_lines(order):
    for order_item in order.items:
        product = Product.query.get(order_item.product_id) if order_item.product_id else None
        routine = Routine.query.get(order_item.routine_id) if order_item.routine_id else None
        yield from stock_lines(product, routine, order_item.quantity)


def decrement_stock_for_order(order):
    """Reduces stock_quantity for every product an order consumes. Called
    once, when an order is confirmed paid. Clamped at 0."""
    for product_row, needed_qty in _order_stock_lines(order):
        product_row.stock_quantity = max(0, product_row.stock_quantity - needed_qty)


def restock_order(order):
    """Reverses decrement_stock_for_order -- restores stock when a paid
    order is cancelled."""
    for product_row, needed_qty in _order_stock_lines(order):
        product_row.stock_quantity += needed_qty
