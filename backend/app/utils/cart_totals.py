def cart_item_unit_price_cents(item):
    """Per-unit price in cents for a cart line -- a single variant, or a
    full routine (its steps' variant prices summed, then bundle-discounted).
    Mirrors frontend/src/lib/cartTotals.js's cartItemUnitPriceCents -- keep
    both in sync if this math ever changes."""
    if item.variant:
        return item.variant.price_cents
    step_total = sum(step.variant.price_cents for step in item.routine.steps)
    discount = item.routine.bundle_discount_percent or 0
    return round(step_total * (100 - discount) / 100)


def cart_subtotal_cents(cart):
    return sum(cart_item_unit_price_cents(item) * item.quantity for item in cart.items)
