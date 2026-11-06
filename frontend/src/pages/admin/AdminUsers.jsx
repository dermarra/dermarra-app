import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import client from "../../api/client";
import { useAuth } from "../../context/AuthContext.jsx";
import { containerReveal } from "../../components/Reveal.jsx";
import {
  Button,
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
  const [rowState, setRowState] = useState({}); // userId -> "saving" | error message
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({}); // userId -> detail dict
  const [detailLoading, setDetailLoading] = useState(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const load = () => {
    setLoading(true);
    client.get("/admin/users").then(({ data }) => setUsers(data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleAdmin = async (targetUser) => {
    setRowState((s) => ({ ...s, [targetUser.id]: "saving" }));
    try {
      const { data } = await client.patch(`/admin/users/${targetUser.id}`, {
        is_admin: !targetUser.is_admin,
      });
      setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)));
      setRowState((s) => {
        const next = { ...s };
        delete next[targetUser.id];
        return next;
      });
    } catch (err) {
      setRowState((s) => ({
        ...s,
        [targetUser.id]: err.response?.data?.error || "Couldn't update this user.",
      }));
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
      <PageHeader title="Users" description="Everyone with an account. Admins can open this dashboard and run orders.">
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

      {loading ? (
        <LoadingState>Loading users…</LoadingState>
      ) : shown.length === 0 ? (
        <EmptyState>No users match.</EmptyState>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {shown.map((u, index) => {
            const state = rowState[u.id];
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
                      <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-800 text-xs font-bold tracking-[0.06em] leading-none">YOU</span>
                    )}
                  </span>
                }
                subtitle={u.email}
                note={state && state !== "saving" ? state : null}
                stats={[
                  { label: "Orders", value: u.order_count },
                  { label: "Spent", value: u.lifetime_value_cents != null ? formatKES(u.lifetime_value_cents) : "—" },
                  { label: "Joined", value: joined(u.created_at) },
                ]}
                badge={<StatusBadge tone={u.is_admin ? "admin" : "neutral"}>{u.is_admin ? "Admin" : "Customer"}</StatusBadge>}
                actions={
                  <>
                    <Button onClick={() => toggleExpand(u)} aria-expanded={isExpanded}>
                      {isExpanded ? "Hide details" : "Details"}
                    </Button>
                    {isSelf && u.is_admin ? (
                      <span className="max-w-[11rem] text-sm leading-snug text-ink/70">You can&apos;t remove your own admin access.</span>
                    ) : (
                      <Button variant={u.is_admin ? "danger" : "secondary"} onClick={() => toggleAdmin(u)} disabled={state === "saving"}>
                        {state === "saving" ? "Saving…" : u.is_admin ? "Remove admin" : "Make admin"}
                      </Button>
                    )}
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
