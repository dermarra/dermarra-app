/** Admin permission checks for the UI. The server enforces every one of
 * these (app/utils/permissions.py); the UI uses them only to hide pages and
 * buttons someone's role doesn't allow, so they never meet a 403. */
export const can = (user, ...keys) => {
  if (!user?.is_admin) return false;
  if (user.admin_role?.is_super) return true;
  const perms = user.permissions || [];
  return keys.some((k) => perms.includes(k));
};

/** Which permission(s) open each admin page (any one is enough). */
export const PAGE_PERMS = {
  dashboard: ["dashboard.view"],
  orders: ["orders.view"],
  coupons: ["coupons.manage"],
  products: ["catalogue.manage"],
  inventory: ["inventory.view"],
  routines: ["catalogue.manage"],
  "hero-slides": ["content.manage"],
  concerns: ["content.manage"],
  ingredients: ["content.manage"],
  "step-groups": ["content.manage"],
  blog: ["blog.manage"],
  users: ["users.view"],
  roles: ["roles.manage"],
  activity: ["activity.view"],
};

export const firstAllowedPage = (user) => Object.keys(PAGE_PERMS).find((page) => can(user, ...PAGE_PERMS[page]));
