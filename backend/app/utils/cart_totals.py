import math


def round_to_shilling(cents):
    """Rounds a cents amount half-up to a whole shilling (a multiple of 100
    cents). M-Pesa only charges whole shillings, so every computed amount
    (bundle prices, coupon discounts) is kept whole -- otherwise the STK
    push charged a rounded amount that didn't match order.total_cents.
    Half-up (not Python's banker's round()) to match JS Math.round in
    frontend/src/lib/cartTotals.js exactly."""
    return int(math.floor(cents / 100 + 0.5)) * 100


def cart_item_unit_price_cents(item):
    """Per-unit price in cents for a cart line -- a single variant, or a
    full routine (its steps' variant prices summed, then bundle-discounted).
    Mirrors frontend/src/lib/cartTotals.js's cartItemUnitPriceCents -- keep
    both in sync if this math ever changes."""
    if item.variant:
        return item.variant.price_cents
    step_total = sum(step.variant.price_cents for step in item.routine.steps)
    discount = item.routine.bundle_discount_percent or 0
    return round_to_shilling(step_total * (100 - discount) / 100)


def cart_subtotal_cents(cart):
    return sum(cart_item_unit_price_cents(item) * item.quantity for item in cart.items)
