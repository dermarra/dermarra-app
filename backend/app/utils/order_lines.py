from app.models.product import Product
from app.models.routine import Routine


def stock_lines(product, routine, quantity):
    """Expands a cart/order line into the (product, quantity_needed) pairs
    it actually consumes -- a routine needs `quantity` units of every
    product in it, not just one."""
    if product:
        return [(product, quantity)]
    return [(step.product, quantity) for step in routine.steps]


def order_stock_lines(order):
    """Yields (order_item, product, quantity_needed) for every line an
    order actually consumes stock for."""
    for order_item in order.items:
        product = Product.query.get(order_item.product_id) if order_item.product_id else None
        routine = Routine.query.get(order_item.routine_id) if order_item.routine_id else None
        for product_row, needed_qty in stock_lines(product, routine, order_item.quantity):
            yield order_item, product_row, needed_qty
