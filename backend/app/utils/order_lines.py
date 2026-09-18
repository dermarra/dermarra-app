from app.models.product import ProductVariant
from app.models.routine import Routine


def stock_lines(variant, routine, quantity):
    """Expands a cart/order line into the (variant, quantity_needed) pairs
    it actually consumes -- a routine needs `quantity` units of every
    variant pinned to its steps, not just one."""
    if variant:
        return [(variant, quantity)]
    return [(step.variant, quantity) for step in routine.steps]


def order_stock_lines(order):
    """Yields (order_item, variant, quantity_needed) for every line an
    order actually consumes stock for. The single implementation of this
    expansion -- inventory_service.py calls this rather than
    reimplementing it, so routine-vs-direct-variant resolution only ever
    lives in one place."""
    for order_item in order.items:
        variant = ProductVariant.query.get(order_item.variant_id) if order_item.variant_id else None
        routine = Routine.query.get(order_item.routine_id) if order_item.routine_id else None
        for variant_row, needed_qty in stock_lines(variant, routine, order_item.quantity):
            yield order_item, variant_row, needed_qty
