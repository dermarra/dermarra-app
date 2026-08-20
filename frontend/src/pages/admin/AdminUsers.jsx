import { useEffect, useState } from "react";
import client from "../../api/client";
import { useAuth } from "../../context/AuthContext.jsx";

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rowState, setRowState] = useState({}); // userId -> "saving" | error message

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
            return (
              <div
                key={u.id}
                className="flex items-center justify-between border border-mist rounded-sm px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {u.full_name} {isSelf && <span className="text-ink/50 font-normal">(you)</span>}
                  </p>
                  <p className="text-xs text-ink/60">
                    {u.email} · {u.order_count} orders · joined {new Date(u.created_at).toLocaleDateString()}
                  </p>
                  {state && state !== "saving" && <p className="text-xs text-clay mt-1">{state}</p>}
                </div>
                <button
                  onClick={() => toggleAdmin(u)}
                  disabled={state === "saving" || (isSelf && u.is_admin)}
                  title={isSelf && u.is_admin ? "You can't remove your own admin access" : ""}
                  className={`px-3 py-1.5 rounded-sm border text-xs shrink-0 disabled:opacity-40 ${
                    u.is_admin ? "border-mist text-clay" : "border-mist text-ink/70"
                  }`}
                >
                  {state === "saving" ? "Saving…" : u.is_admin ? "Revoke admin" : "Make admin"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
