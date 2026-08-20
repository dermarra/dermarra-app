FORWARD_STEPS = ("paid", "processing", "shipped", "delivered")

CANCELLABLE_STATUSES = {"paid", "processing", "shipped"}


def can_advance(current_status, new_status):
    """True only if new_status is exactly the next step after current_status
    in paid -> processing -> shipped -> delivered."""
    if current_status not in FORWARD_STEPS or new_status not in FORWARD_STEPS:
        return False
    return FORWARD_STEPS.index(new_status) == FORWARD_STEPS.index(current_status) + 1


def can_cancel(current_status):
    return current_status in CANCELLABLE_STATUSES
