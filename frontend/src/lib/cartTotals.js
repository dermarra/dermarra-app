// Shared cart-line pricing math -- used by Cart.jsx and Checkout.jsx so the
// variant-aware calculation only has to be written once. A cart item is
// either a single variant (item.variant) or a full routine (item.routine,
// whose steps are each pinned to a specific variant too -- see
// RoutineStep.variant_id).

export function routineStepsTotalCents(routine) {
  return routine.steps.reduce((sum, step) => sum + step.variant.price_cents, 0);
}

export function cartItemUnitPriceCents(item) {
  if (item.variant) return item.variant.price_cents;
  const stepsTotal = routineStepsTotalCents(item.routine);
  return Math.round((stepsTotal * (100 - (item.routine.bundle_discount_percent || 0))) / 100);
}

// For the routine strikethrough price -- null for a plain variant line,
// since there's no "undiscounted" price to show.
export function cartItemUndiscountedCents(item) {
  return item.routine ? routineStepsTotalCents(item.routine) : null;
}

export function cartTotalCents(items) {
  return items.reduce((sum, item) => sum + cartItemUnitPriceCents(item) * item.quantity, 0);
}
