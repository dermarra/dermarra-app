import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { can, firstAllowedPage, PAGE_PERMS } from "../../lib/permissions.js";
import { Button, EmptyState } from "./Kit.jsx";

/** Wraps an admin page: renders it only if the signed-in admin's role
 * opens it, otherwise explains why (with a way to somewhere they can go). */
export default function RequirePermission({ page, children }) {
  const { user } = useAuth();
  if (can(user, ...(PAGE_PERMS[page] || []))) return children;
  const home = firstAllowedPage(user);
  return (
    <div className="max-w-xl">
      <h2 className="text-4xl font-semibold leading-tight">No access</h2>
      <p className="mt-3 text-ink/70">
        Your role ({user?.admin_role?.name || "none"}) doesn&apos;t include this page. A super admin can change your access under People, then Users.
      </p>
      <div className="mt-6">{home ? <Button variant="primary" size="lg" to={`/admin/${home}`}>Go to {home.replace("-", " ")}</Button> : <EmptyState>Your role doesn&apos;t open any admin pages yet.</EmptyState>}</div>
    </div>
  );
}

/** /admin with no page: the first page this admin can open. */
export function AdminHome() {
  const { user } = useAuth();
  const home = firstAllowedPage(user);
  return home ? <Navigate to={home} replace /> : <RequirePermission page="dashboard" />;
}
