"""Admin permissions: the fixed list every admin endpoint checks against.

Roles (``AdminRole`` rows) are editable bundles of these keys, but the keys
themselves live here in code -- an endpoint can never be left guarded by a
permission nobody can grant, and a typo fails loudly in tests rather than
silently locking a page. A super-admin role (``is_super``) implicitly holds
every permission, including ones added later.
"""

# key -> (group, label, help). Order = how the role editor lists them.
PERMISSIONS = {
    "dashboard.view": ("Overview", "See the dashboard", "Sales figures, to-do counts and stock alerts."),
    "orders.view": ("Orders", "See orders", "Open orders and their details, read only."),
    "orders.fulfil": (
        "Orders",
        "Process and dispatch orders",
        "Move orders along (processing, shipped, delivered), add tracking, upload delivery photos, "
        "email invoices, check payments with M-Pesa.",
    ),
    "orders.cancel": ("Orders", "Cancel paid orders", "Puts the stock back; the M-Pesa refund is done by hand."),
    "coupons.manage": ("Sales", "Manage coupons", "Create, edit and switch off discount codes."),
    "catalogue.manage": (
        "Catalogue",
        "Manage products and routines",
        "Products, sizes, prices, photos and routine bundles.",
    ),
    "inventory.view": ("Catalogue", "See stock", "Stock levels, batches and stock history, read only."),
    "inventory.manage": (
        "Catalogue",
        "Manage stock",
        "Log production runs and adjust stock (damage, expiry, stocktake).",
    ),
    "content.manage": (
        "Storefront",
        "Manage storefront content",
        "Hero slides, concerns, ingredients and Shop by Step.",
    ),
    "blog.manage": (
        "Storefront",
        "Manage the blog",
        "Write, schedule and publish blog posts, and manage blog categories.",
    ),
    "users.view": ("People", "See users", "Customer and admin accounts, with order history."),
    "roles.manage": (
        "People",
        "Manage roles and access",
        "Create and edit roles, and choose who has admin access. Give this sparingly.",
    ),
    "activity.view": ("People", "See the activity log", "Every admin change: who did what, and when."),
}

# Having the key on the left also counts as having the ones on the right
# (you can't cancel or dispatch an order you can't see).
_IMPLIED_BY = {
    "orders.view": {"orders.fulfil", "orders.cancel"},
    "inventory.view": {"inventory.manage"},
    "users.view": {"roles.manage"},
}

# The preset roles seeded by the migration (editable afterwards, except the
# super-admin role). Kept here so tests and docs share one definition.
PRESET_ROLES = {
    "super_admin": {
        "name": "Super admin",
        "description": "Everything, including roles and who has access. Can't be edited or deleted.",
        "permissions": [],  # is_super: holds every permission
        "is_super": True,
    },
    "store_manager": {
        "name": "Store manager",
        "description": "Runs the whole store: orders, cancellations, products, stock, coupons and content.",
        "permissions": [p for p in PERMISSIONS if p != "roles.manage"],
    },
    "orders_dispatch": {
        "name": "Orders & dispatch",
        "description": "Packs and sends orders: processing, shipping, tracking, delivery photos, invoices.",
        "permissions": ["dashboard.view", "orders.view", "orders.fulfil", "inventory.view"],
    },
    "catalogue_stock": {
        "name": "Catalogue & stock",
        "description": "Products, sizes, photos, routines, production runs and stock adjustments.",
        "permissions": ["dashboard.view", "catalogue.manage", "inventory.view", "inventory.manage"],
    },
    "marketing_content": {
        "name": "Marketing & content",
        "description": "Homepage slides, concerns, ingredients, Shop by Step, the blog and coupons.",
        "permissions": ["dashboard.view", "content.manage", "blog.manage", "coupons.manage"],
    },
}


def clean_permissions(keys):
    """Known keys only, in catalogue order, no duplicates."""
    wanted = set(keys or [])
    return [k for k in PERMISSIONS if k in wanted]


def role_permissions(role):
    if role is None:
        return set()
    if role.is_super:
        return set(PERMISSIONS)
    granted = set(role.permissions or [])
    for implied, sources in _IMPLIED_BY.items():
        if granted & sources:
            granted.add(implied)
    return granted & set(PERMISSIONS)


def user_permissions(user):
    if user is None or not user.is_admin:
        return set()
    return role_permissions(user.admin_role)


def has_permission(user, *keys):
    """True if the user holds ANY of the given permission keys."""
    perms = user_permissions(user)
    return any(k in perms for k in keys)
