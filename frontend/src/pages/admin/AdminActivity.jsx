import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import client from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { can } from "../../lib/permissions.js";
import { containerReveal, itemReveal } from "../../components/Reveal.jsx";
import { Button, EmptyState, ErrorText, FilterTabs, LoadingState, PageHeader, StatusBadge, Toolbar, selectClass } from "../../components/admin/Kit.jsx";

const AREAS = [
  { value: "", label: "Everything" },
  { value: "orders", label: "Orders" },
  { value: "catalogue", label: "Catalogue" },
  { value: "inventory", label: "Stock" },
  { value: "content", label: "Content" },
  { value: "coupons", label: "Coupons" },
  { value: "access", label: "Access" },
];
const AREA_TONE = { orders: "info", catalogue: "good", inventory: "good", content: "admin", coupons: "warn", access: "neutral" };
const AREA_LABEL = Object.fromEntries(AREAS.map((a) => [a.value, a.label]));

/** Where an entry's target lives in the admin, when it has a page. */
function targetLink(item) {
  const id = item.target_id;
  if (!id) return null;
  if (item.target_type === "order") return `/admin/orders/${id}`;
  if (item.target_type === "variant" && item.path.includes("/inventory/")) return `/admin/inventory/${id}`;
  if (item.target_type === "product") return `/admin/products?edit=${id}`;
  return null;
}

const day = (iso) => new Date(iso).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const time = (iso) => new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });

export default function AdminActivity() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [area, setArea] = useState("");
  const [actor, setActor] = useState("");
  const [admins, setAdmins] = useState([]);

  const fetchPage = (before) =>
    client.get("/admin/activity", { params: { area: area || undefined, actor: actor || undefined, before, limit: 50 } });

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPage()
      .then(({ data }) => {
        setItems(data.items);
        setHasMore(data.has_more);
      })
      .catch((err) => setError(err.response?.data?.error || "Couldn't load the activity log."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, actor]);

  useEffect(() => {
    if (!can(user, "users.view")) return;
    client
      .get("/admin/users")
      .then(({ data }) => setAdmins(data.filter((u) => u.is_admin)))
      .catch(() => {});
  }, [user]);

  const loadMore = () =>
    fetchPage(items[items.length - 1]?.created_at).then(({ data }) => {
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(data.has_more);
    });

  // Group by day for scanning.
  const days = [];
  items.forEach((it) => {
    const d = day(it.created_at);
    if (!days.length || days[days.length - 1].day !== d) days.push({ day: d, items: [] });
    days[days.length - 1].items.push(it);
  });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <PageHeader title="Activity" description="Every change made in the admin: who did it, what, and when. Kept permanently.">
        <Toolbar>
          <FilterTabs value={area} onChange={setArea} options={AREAS} label="Area" />
          {admins.length > 0 && (
            <label className="w-full sm:w-64">
              <span className="sr-only">Who</span>
              <select value={actor} onChange={(e) => setActor(e.target.value)} className={`${selectClass} h-12`}>
                <option value="">Everyone</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </Toolbar>
      </PageHeader>

      <ErrorText>{error}</ErrorText>
      {loading ? (
        <LoadingState>Loading activity…</LoadingState>
      ) : items.length === 0 ? (
        <EmptyState>Nothing recorded here yet. Changes appear as soon as anyone makes them.</EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {days.map((group) => (
            <section key={group.day}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink/70">{group.day}</h3>
              <motion.ol initial="hidden" animate="show" variants={containerReveal} className="bg-white border border-mist rounded-lg divide-y divide-mist">
                {group.items.map((it) => {
                  const areaKey = it.action.split(".")[0];
                  const link = targetLink(it);
                  return (
                    <motion.li key={it.id} variants={itemReveal} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-4">
                      <span className="w-14 shrink-0 tabular-nums text-ink/70">{time(it.created_at)}</span>
                      <span className="w-9 h-9 shrink-0 rounded-full bg-lime-100 text-lime-900 font-bold flex items-center justify-center">
                        {(it.actor_name || "?").trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-[14rem]">
                        <span className="font-semibold">{it.actor_name || "Someone"}</span> <span className="text-ink/80">{it.summary.charAt(0).toLowerCase() + it.summary.slice(1)}</span>
                        {link && (
                          <>
                            {" · "}
                            <Link to={link} className="font-semibold text-blue-700 underline underline-offset-2">
                              Open
                            </Link>
                          </>
                        )}
                      </span>
                      <StatusBadge tone={AREA_TONE[areaKey] || "neutral"}>{AREA_LABEL[areaKey] || "Other"}</StatusBadge>
                    </motion.li>
                  );
                })}
              </motion.ol>
            </section>
          ))}
          {hasMore && (
            <Button className="self-center" onClick={loadMore}>
              Show older
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
