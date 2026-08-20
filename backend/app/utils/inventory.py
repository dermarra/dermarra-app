def stock_lines(product, routine, quantity):
    """Expands a cart/order line into the (product, quantity_needed) pairs
    it actually consumes -- a routine needs `quantity` units of every
    product in it, not just one."""
    if product:
        return [(product, quantity)]
    return [(step.product, quantity) for step in routine.steps]