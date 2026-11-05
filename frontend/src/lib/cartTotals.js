// Shared cart-line pricing math -- used by Cart.jsx and Checkout.jsx so the
// variant-aware calculation only has to be written once. A cart item is
// either a single variant (item.variant) or a full routine (item.routine,
// whose steps are each pinned to a specific variant too -- see
// RoutineStep.variant_id).

// Half-up to a whole shilling -- mirrors backend/app/utils/cart_totals.py's
// round_to_shilling (M-Pesa only charges whole shillings).
export function roundToShilling(cents) {
  return Math.round(cents / 100) * 100;
}

export function routineStepsTotalCents(routine) {
  return routine.steps.reduce((sum, step) => sum + step.variant.price_cents, 0);
}

export function cartItemUnitPriceCents(item) {
  if (item.variant) return item.variant.price_cents;
  const stepsTotal = routineStepsTotalCents(item.routine);
  return roundToShilling((stepsTotal * (100 - (item.routine.bundle_discount_percent || 0))) / 100);
}

// For the routine strikethrough price -- null for a plain variant line,
// since there's no "undiscounted" price to show.
export function cartItemUndiscountedCents(item) {
  return item.routine ? routineStepsTotalCents(item.routine) : null;
}

export function cartSubtotalCents(items) {
  return items.reduce((sum, item) => sum + cartItemUnitPriceCents(item) * item.quantity, 0);
}

export function cartTotalCents(items) {
  return cartSubtotalCents(items);
}

// Mirrors backend/app/services/coupon_service.py's validate_and_price math
// (percent or fixed_cents off the subtotal, clamped so it can never exceed
// it) -- this is a display-only preview; the backend always recomputes and
// re-validates the real discount at checkout, never trusts this value.
export function cartDiscountCents(cart, subtotalCents) {
  if (!cart.coupon) return 0;
  const raw =
    cart.coupon.discount_type === "percent"
      ? roundToShilling((subtotalCents * cart.coupon.discount_value) / 100)
      : cart.coupon.discount_value;
  return Math.min(raw, subtotalCents);
}
