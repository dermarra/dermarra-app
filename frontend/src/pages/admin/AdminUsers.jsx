import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import client from "../../api/client";
import { useAuth } from "../../context/AuthContext.jsx";
import { containerReveal } from "../../components/Reveal.jsx";
import { can } from "../../lib/permissions.js";
import {
  Button,
  EditorDrawer,
  EmptyState,
  FilterTabs,
  ListRow,
  LoadingState,
  PageHeader,
  SearchBox,
  StatusBadge,
  Thumb,
  Toolbar,
  matches,
} from "../../components/admin/Kit.jsx";

function formatKES(cents) {
  return `KES ${(cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({}); // userId -> detail dict
  const [detailLoading, setDetailLoading] = useState(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [roles, setRoles] = useState([]);
  const [accessFor, setAccessFor] = useState(null); // user whose access is being changed
  const [pickedRole, setPickedRole] = useState("");
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState(null);
  const canAssign = can(currentUser, "roles.manage");
  const iAmSuper = !!currentUser?.admin_role?.is_super;

  const load = () => {
    setLoading(true);
    client.get("/admin/users").then(({ data }) => setUsers(data)).finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    client
      .get("/admin/roles")
      .then(({ data }) => setRoles(data))
      .catch(() => setRoles([]));
  }, []);

  const openAccess = (u) => {
    setAccessFor(u);
    setPickedRole(u.is_admin && u.admin_role ? u.admin_role.id : "");
    setAccessError(null);
  };

  const saveAccess = async (e) => {
    e.preventDefault();
    if (!accessFor) return;
    setAccessSaving(true);
    setAccessError(null);
    try {
      const { data } = await client.patch(`/admin/users/${accessFor.id}`, { admin_role_id: pickedRole || null });
      setUsers((prev) => prev.map((u) => (u.id === data.id ? { ...u, ...data } : u)));
      setAccessFor(null);
    } catch (err) {
      setAccessError(err.response?.data?.error || "Couldn't change this person's access.");
    } finally {
      setAccessSaving(false);
    }
  };

  const toggleExpand = (u) => {
    if (expandedId === u.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(u.id);
    if (!details[u.id]) {
      setDetailLoading(u.id);
      client
        .get(`/admin/users/${u.id}`)
        .then(({ data }) => setDetails((d) => ({ ...d, [u.id]: data })))
        .finally(() => setDetailLoading(null));
    }
  };

  const adminCount = users.filter((u) => u.is_admin).length;
  const shown = users.filter(
    (u) =>
      (roleFilter === "" || (roleFilter === "admins" ? u.is_admin : !u.is_admin)) && matches(query, u.full_name, u.email)
  );
  const joined = (iso) => new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <PageHeader title="Users" description="Everyone with an account. An admin's role decides which admin pages they can open and what they can change.">
        <Toolbar>
          <FilterTabs
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: "", label: "All", count: users.length },
              { value: "admins", label: "Admins", count: adminCount },
              { value: "customers", label: "Customers", count: users.length - adminCount },
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="Search name or email" />
        </Toolbar>
      </PageHeader>

      <EditorDrawer
        open={!!accessFor}
        title={accessFor ? `Access for ${accessFor.full_name}` : "Access"}
        description="Choose what they can do in the admin. It applies the next time they open a page."
        onClose={() => setAccessFor(null)}
        onSubmit={saveAccess}
        saving={accessSaving}
        error={accessError}
        submitLabel="Save access"
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Role</legend>
          {[{ id: "", name: "No admin access", description: "A customer account: shop and orders only.", is_super: false }, ...roles].map((r) => {
            const locked = r.is_super && !iAmSuper;
            const selected = pickedRole === r.id;
            return (
              <label
                key={r.id || "none"}
                className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  selected ? "border-blue bg-blue-50" : "border-mist bg-white hover:border-ink/30"
                } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.id}
                  checked={selected}
                  disabled={locked}
                  onChange={() => setPickedRole(r.id)}
                  className="mt-1 w-5 h-5 accent-blue shrink-0"
                />
                <span className="min-w-0">
                  <span className="block font-semibold">{r.name}</span>
                  {r.description && <span className="block text-sm text-ink/70">{r.description}</span>}
                  {locked && <span className="block mt-1 text-sm text-orange-800">Only a super admin can give this role.</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
      </EditorDrawer>

      {loading ? (
        <LoadingState>Loading users…</LoadingState>
      ) : shown.length === 0 ? (
        <EmptyState>No users match.</EmptyState>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {shown.map((u, index) => {
            const isSelf = u.id === currentUser?.id;
            const isExpanded = expandedId === u.id;
            const detail = details[u.id];
            return (
              <ListRow
                key={u.id}
                thumb={<Thumb name={u.full_name || u.email} index={index} round />}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {u.full_name}
                    {isSelf && (
                      <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-800 text-xs font-bold tracking-[0.06em] leading-none">YOU</span>
                    )}
                  </span>
                }
                subtitle={u.email}
                stats={[
                  { label: "Orders", value: u.order_count },
                  { label: "Spent", value: u.lifetime_value_cents != null ? formatKES(u.lifetime_value_cents) : "—" },
                  { label: "Joined", value: joined(u.created_at) },
                ]}
                badge={
                  <StatusBadge tone={u.is_admin ? "admin" : "neutral"}>{u.is_admin ? u.admin_role?.name || "Admin" : "Customer"}</StatusBadge>
                }
                actions={
                  <>
                    <Button onClick={() => toggleExpand(u)} aria-expanded={isExpanded}>
                      {isExpanded ? "Hide details" : "Details"}
                    </Button>
                    {canAssign &&
                      (isSelf ? (
                        <span className="max-w-[11rem] text-sm leading-snug text-ink/70">You can&apos;t change your own access.</span>
                      ) : (
                        <Button variant="secondary" onClick={() => openAccess(u)}>
                          Change access
                        </Button>
                      ))}
                  </>
                }
                below={
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden border-t border-mist"
                      >
                        <div className="px-6 py-5 bg-bone-light rounded-b-lg">
                          {detailLoading === u.id ? (
                            <LoadingState>Loading profile…</LoadingState>
                          ) : detail ? (
                            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/70">Last delivery address</p>
                                <p className="mt-1 text-ink">
                                  {detail.last_shipping_address
                                    ? `${detail.last_shipping_address.address_line1}, ${detail.last_shipping_address.city}, ${detail.last_shipping_address.country}`
                                    : "None yet"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/70">Recent orders</p>
                                {detail.recent_orders?.length ? (
                                  <ul className="mt-1 divide-y divide-mist">
                                    {detail.recent_orders.map((order) => (
                                      <li key={order.id}>
                                        <Link
                                          to={`/admin/orders/${order.id}`}
                                          className="flex items-center justify-between gap-4 py-2 text-ink hover:text-blue-700"
                                        >
                                          <span className="font-semibold">#{order.id.slice(0, 8)}</span>
                                          <span className="text-ink/70 capitalize">{order.status.replace(/_/g, " ")}</span>
                                          <span className="tabular-nums">{formatKES(order.total_cents)}</span>
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-1 text-ink">No orders yet.</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-orange-700">Couldn&apos;t load this profile.</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                }
              />
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
