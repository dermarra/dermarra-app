def unavailable_reason(variant, routine):
    """Why a cart line (one variant, or a whole routine) can't be sold
    right now, or None if it can. Used both when adding to cart and again
    at checkout, since an admin can deactivate things in between --
    previously neither checked, so discontinued sizes stayed purchasable."""
    if variant is not None:
        if not variant.is_active or not variant.product.is_active:
            return f"{variant.product.name} ({variant.label}) is no longer sold"
        return None

    if routine is None:
        return "item not found"
    if not routine.is_active:
        return f"{routine.name} is no longer available"
    if not routine.steps:
        return f"{routine.name} has no products in it yet"
    for step in routine.steps:
        if not step.variant.is_active or not step.variant.product.is_active:
            return (
                f"{routine.name} includes {step.variant.product.name} ({step.variant.label}), "
                "which is no longer sold"
            )
    return None
