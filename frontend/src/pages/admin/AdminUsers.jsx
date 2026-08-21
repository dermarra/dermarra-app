import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../api/client";
import { useAuth } from "../../context/AuthContext.jsx";

function formatKES(cents) {
  return `KES ${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rowState, setRowState] = useState({}); // userId -> "saving" | error message
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({}); // userId -> detail dict
  const [detailLoading, setDetailLoading] = useState(null);

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

  return (
    <div>
      <h2 className="font-display text-xl mb-4">Users</h2>

      {loading ? (
        <p className="text-ink/60 text-sm">Loading users…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => {
            const state = rowState[u.id];
            const isSelf = u.id === currentUser?.id;
            const isExpanded = expandedId === u.id;
            const detail = details[u.id];
            return (
              <div key={u.id} className="border border-mist rounded-sm">
                <div
                  onClick={() => toggleExpand(u)}
                  className="flex items-center justify-between px-4 py-3 cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {u.full_name} {isSelf && <span className="text-ink/50 font-normal">(you)</span>}
                    </p>
                    <p className="text-xs text-ink/60">
                      {u.email} · {u.order_count} orders
                      {u.lifetime_value_cents != null && ` · ${formatKES(u.lifetime_value_cents)} lifetime`} ·
                      joined {new Date(u.created_at).toLocaleDateString()}
                    </p>
                    {state && state !== "saving" && <p className="text-xs text-clay mt-1">{state}</p>}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAdmin(u);
                    }}
                    disabled={state === "saving" || (isSelf && u.is_admin)}
                    title={isSelf && u.is_admin ? "You can't remove your own admin access" : ""}
                    className={`px-3 py-1.5 rounded-sm border text-xs shrink-0 disabled:opacity-40 ${
                      u.is_admin ? "border-mist text-clay" : "border-mist text-ink/70"
                    }`}
                  >
                    {state === "saving" ? "Saving…" : u.is_admin ? "Revoke admin" : "Make admin"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-mist px-4 py-3 bg-bone-light">
                    {detailLoading === u.id ? (
                      <p className="text-xs text-ink/60">Loading profile…</p>
                    ) : detail ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex gap-6">
                          <div>
                            <p className="text-xs text-ink/60 uppercase tracking-wide font-mono">Lifetime value</p>
                            <p className="text-sm font-semibold text-ink">
                              {formatKES(detail.lifetime_value_cents)}
                            </p>
                          </div>
                          {detail.last_shipping_address && (
                            <div>
                              <p className="text-xs text-ink/60 uppercase tracking-wide font-mono">
                                Last shipping address
                              </p>
                              <p className="text-sm text-ink">
                                {detail.last_shipping_address.address_line1}, {detail.last_shipping_address.city},{" "}
                                {detail.last_shipping_address.country}
                              </p>
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-xs text-ink/60 uppercase tracking-wide font-mono mb-2">
                            Recent orders
                          </p>
                          {detail.recent_orders?.length ? (
                            <div className="flex flex-col gap-2">
                              {detail.recent_orders.map((order) => (
                                <Link
                                  key={order.id}
                                  to={`/admin/orders/${order.id}`}
                                  className="flex items-center justify-between text-sm hover:text-amber"
                                >
                                  <span className="font-mono text-xs">{order.id.slice(0, 8)}</span>
                                  <span className="text-xs uppercase text-ink/60">{order.status}</span>
                                  <span>{formatKES(order.total_cents)}</span>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-ink/60">No orders yet.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-clay">Could not load this profile.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
