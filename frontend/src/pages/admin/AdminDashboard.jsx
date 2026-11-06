import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import client from "../../api/client";
import { PageHeader, FilterTabs } from "../../components/admin/Kit.jsx";
import { containerReveal, itemReveal } from "../../components/Reveal.jsx";
import { AlertIcon, BoxIcon, ReceiptIcon, TrendIcon, UsersIcon } from "../../components/Icons.jsx";

// Chart marks are the brand blue itself (#1D9CD7, 3.1:1 on white -- clears
// the 3:1 floor for graphics). Gridlines recessive, axis text in ink.
const MARK = "#1D9CD7";
const GRID = "#ECECEB";
const AXIS_TEXT = "#4A4547";

// KPI icon tiles: solid brand colours with brand-black icons (literal class
// strings so Tailwind keeps them).
const TONES = {
  blue: "bg-blue",
  orange: "bg-orange",
  lime: "bg-lime",
  gold: "bg-gold",
};

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

// Order states: label + dot. Status colours carry meaning only alongside
// the text label, never on their own.
const STATUS = {
  pending: { label: "Awaiting payment", dot: "bg-gold" },
  payment_pending: { label: "Paying (M-Pesa)", dot: "bg-gold" },
  paid: { label: "Paid · to process", dot: "bg-blue" },
  processing: { label: "Processing", dot: "bg-blue" },
  shipped: { label: "Shipped", dot: "bg-blue" },
  delivered: { label: "Delivered", dot: "bg-lime" },
  payment_failed: { label: "Payment failed", dot: "bg-orange" },
  cancelled: { label: "Cancelled", dot: "bg-ink/30" },
};

const kes = (cents) => `KES ${Math.round((cents || 0) / 100).toLocaleString("en-KE")}`;
const pct = (ratio) => (ratio == null ? "—" : `${(ratio * 100).toFixed(ratio >= 0.1 || ratio === 0 ? 0 : 1)}%`);

function periodLabel(range) {
  return { today: "yesterday", "7d": "previous 7 days", "30d": "previous 30 days", "90d": "previous 90 days" }[range];
}

/** ▲/▼ + percentage + words, so the change never relies on colour alone. */
function Delta({ current, previous, range, invert = false }) {
  if (current == null || previous == null) return null;
  let text;
  let tone = "text-ink/70";
  let arrow = "";
  if (current === previous) {
    text = "no change";
  } else if (!previous) {
    text = "new this period";
    arrow = "▲";
    tone = invert ? "text-orange-700" : "text-lime-800";
  } else {
    const change = (current - previous) / previous;
    const up = change > 0;
    arrow = up ? "▲" : "▼";
    text = `${Math.abs(change * 100).toFixed(0)}%`;
    tone = up !== invert ? "text-lime-800" : "text-orange-700";
  }
  return (
    <p className="text-sm mt-1">
      <span className={`font-semibold ${tone}`}>
        {arrow && <span aria-hidden="true">{arrow} </span>}
        {text}
      </span>
      <span className="text-ink/70"> vs {periodLabel(range)}</span>
    </p>
  );
}

function Card({ title, subtitle, action, children, className = "" }) {
  return (
    <motion.section
      variants={itemReveal}
      className={`bg-white border border-mist rounded-xl shadow-sm p-5 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && <h3 className="text-xl font-bold text-ink">{title}</h3>}
            {subtitle && <p className="text-sm text-ink/70 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </motion.section>
  );
}

/** Orbit-style KPI card: label + big value, a solid brand-colour icon tile.
 * The hero (revenue) card is solid brand blue with brand-black text -- no
 * gradients, and white on blue would only be 3.1:1. */
function KpiTile({ label, value, hint, delta, hero = false, Icon, tone = "blue" }) {
  return (
    <motion.div
      variants={itemReveal}
      className={`h-full rounded-xl p-5 ${hero ? "bg-blue text-ink" : "bg-white border border-mist shadow-sm"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${hero ? "text-ink" : "text-ink/70"}`}>{label}</p>
          <p className={`font-display font-bold tabular-nums mt-2 text-ink ${hero ? "text-4xl sm:text-5xl" : "text-2xl whitespace-nowrap"}`}>
            {value}
          </p>
        </div>
        {Icon && (
          <span
            aria-hidden="true"
            className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-ink ${
              hero ? "bg-white/35" : TONES[tone]
            }`}
          >
            <Icon className="w-5 h-5" />
          </span>
        )}
      </div>
      {hint && <p className={`text-sm mt-1 ${hero ? "text-ink font-medium" : "text-ink/70"}`}>{hint}</p>}
      {hero ? <div className="[&_*]:!text-ink">{delta}</div> : delta}
    </motion.div>
  );
}

// ---------- To-do strip ----------

const TODO_ITEMS = [
  { key: "to_process", label: "Paid orders to process", to: "/admin/orders", urgent: true },
  { key: "to_ship", label: "Orders to ship", to: "/admin/orders", urgent: true },
  { key: "in_transit", label: "Out for delivery", to: "/admin/orders" },
  { key: "stuck_payments", label: "Payments stuck >10 min", to: "/admin/orders", urgent: true,
    help: "Open the order and use “Refresh payment status”." },
  { key: "unallocated_paid_orders", label: "Paid orders without stock", to: "/admin/orders", urgent: true,
    help: "Paid after the items sold out — check before shipping." },
  { key: "out_of_stock_sizes", label: "Sizes out of stock", to: "/admin/inventory?status=out_of_stock", urgent: true },
  { key: "low_stock_sizes", label: "Sizes running low", to: "/admin/inventory?status=low_stock" },
  { key: "expiring_batches", label: "Batches expiring ≤30 days", to: "/admin/inventory" },
  { key: "products_without_sizes", label: "Products with no sizes", to: "/admin/inventory?status=out_of_stock",
    help: "Hidden from the shop until a size is added." },
];

function TodoStrip({ todo }) {
  const open = TODO_ITEMS.filter((t) => (todo[t.key] || 0) > 0);
  if (open.length === 0) {
    return (
      <motion.div
        variants={itemReveal}
        className="flex items-center gap-3 rounded-lg border border-lime/40 bg-white px-5 py-4"
      >
        <span aria-hidden="true" className="w-8 h-8 rounded-full bg-lime/20 text-lime-800 flex items-center justify-center">✓</span>
        <div>
          <p className="text-sm font-semibold text-ink">All caught up</p>
          <p className="text-sm text-ink/70">No orders waiting, no stock problems.</p>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div variants={itemReveal}>
      <h3 className="text-xl font-semibold text-ink mb-2">Needs your attention</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {open.map((t) => (
          <Link
            key={t.key}
            to={t.to}
            className={`group flex items-start gap-3 rounded-lg border bg-white p-4 transition-colors hover:border-blue-600 ${
              t.urgent ? "border-l-4 border-l-orange border-mist" : "border-mist"
            }`}
          >
            <span className="font-display font-bold text-3xl tabular-nums text-ink leading-none">{todo[t.key]}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink group-hover:text-ink">{t.label} →</span>
              {t.help && <span className="block text-sm text-ink/70 mt-0.5">{t.help}</span>}
            </span>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}

// ---------- Revenue chart ----------

function dayLabel(iso, range) {
  const d = new Date(`${iso}T00:00:00`);
  return range === "7d" || range === "today"
    ? d.toLocaleDateString("en-KE", { weekday: "short", day: "numeric" })
    : d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

function RevenueTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-mist bg-white px-3 py-2 text-xs shadow-md">
      <p className="text-ink/70 mb-1">{p.full}</p>
      <p className="font-semibold text-ink tabular-nums">{kes(p.revenue_cents)}</p>
      <p className="text-ink/70">{p.paid_orders} paid order{p.paid_orders === 1 ? "" : "s"}</p>
    </div>
  );
}

function RevenueChart({ days, range }) {
  const data = days.map((d) => ({
    ...d,
    label: dayLabel(d.date, range),
    full: new Date(`${d.date}T00:00:00`).toLocaleDateString("en-KE", {
      weekday: "long", day: "numeric", month: "long",
    }),
    kes: d.revenue_cents / 100,
  }));
  const empty = data.every((d) => d.revenue_cents === 0);
  return (
    <>
      {empty ? (
        // No axes when there's nothing to plot -- an empty 0-4 grid behind
        // the message read as data.
        <div className="h-64 rounded-md border border-dashed border-mist bg-blue-50 flex flex-col items-center justify-center text-center px-6">
          <p className="text-sm font-semibold text-ink">No paid orders in this period yet</p>
          <p className="text-sm text-ink/70 mt-1">Revenue appears here per day as M-Pesa payments are confirmed.</p>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: AXIS_TEXT }}
                tickLine={false}
                axisLine={{ stroke: GRID }}
                interval="preserveStartEnd"
                minTickGap={12}
              />
              <YAxis
                tick={{ fontSize: 12, fill: AXIS_TEXT }}
                tickLine={false}
                axisLine={false}
                width={56}
                allowDecimals={false}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
              />
              <Tooltip content={<RevenueTooltip />} cursor={{ fill: "rgba(0,134,192,0.08)" }} />
              {/* No entrance animation: inside the revealing card it never
                  started, leaving the chart blank (seen in testing). */}
              <Bar dataKey="kes" fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-blue-700 font-semibold">View as table</summary>
        <table className="w-full mt-2 tabular-nums">
          <thead>
            <tr className="text-left text-ink/70">
              <th className="py-1 font-semibold">Day</th>
              <th className="py-1 font-semibold text-right">Paid orders</th>
              <th className="py-1 font-semibold text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t border-mist">
                <td className="py-1">{d.full}</td>
                <td className="py-1 text-right">{d.paid_orders}</td>
                <td className="py-1 text-right">{kes(d.revenue_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

/** Ranked horizontal bars, one hue, value printed -- for outcomes / sellers. */
function RankedBars({ rows, valueOf, labelOf, formatValue, empty }) {
  if (!rows.length) return <p className="text-sm text-ink/70">{empty}</p>;
  const max = Math.max(...rows.map(valueOf), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={labelOf(row)} title={`${labelOf(row)}: ${formatValue(row)}`}>
          <div className="flex justify-between gap-3 text-sm mb-1">
            <span className="text-ink truncate">{labelOf(row)}</span>
            <span className="text-ink font-semibold tabular-nums shrink-0">{formatValue(row)}</span>
          </div>
          <div className="h-2 rounded-full bg-blue-50">
            <div
              className="h-2 rounded-full"
              style={{ width: `${(valueOf(row) / max) * 100}%`, backgroundColor: MARK }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatusChip({ status }) {
  const s = STATUS[status] || { label: status, dot: "bg-ink/30" };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-white px-2.5 py-0.5 text-xs text-ink whitespace-nowrap">
      <span aria-hidden="true" className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ---------- Page ----------

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = RANGES.some((r) => r.value === searchParams.get("range")) ? searchParams.get("range") : "7d";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    client
      .get("/admin/dashboard", { params: { range } })
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.error || "Couldn't load dashboard data."))
      .finally(() => setLoading(false));
  }, [range]);

  const setRange = (value) => setSearchParams(value === "7d" ? {} : { range: value });

  const periodText = data
    ? data.period.days === 1
      ? "Today, Kenyan time."
      : `${new Date(`${data.period.start}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" })} – ${new Date(`${data.period.end}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}, Kenyan time.`
    : "Loading…";

  const header = (
    <PageHeader
      title="Overview"
      description={periodText}
      actions={<FilterTabs label="Time period" value={range} onChange={setRange} options={RANGES} />}
    />
  );

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p className="text-sm text-orange-700">{error}</p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        {header}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-white border border-mist animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-lg bg-white border border-mist animate-pulse" />
      </div>
    );
  }

  const { kpis, previous_kpis: prev } = data;
  const totalOutcomes = data.payment_outcomes.reduce((s, o) => s + o.count, 0);

  return (
    <motion.div
      key={range}
      initial="hidden"
      animate="show"
      variants={containerReveal}
      className={`flex flex-col gap-6 transition-opacity ${loading ? "opacity-60" : ""}`}
    >
      {header}

      <TodoStrip todo={data.todo} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="sm:col-span-2">
          <KpiTile
            hero
            label="Revenue"
            Icon={TrendIcon}
            value={kes(kpis.revenue_cents)}
            hint={`${kpis.paid_orders} paid order${kpis.paid_orders === 1 ? "" : "s"}`}
            delta={<Delta current={kpis.revenue_cents} previous={prev.revenue_cents} range={range} />}
          />
        </div>
        <KpiTile
          label="Average order"
          Icon={ReceiptIcon}
          tone="orange"
          value={kpis.paid_orders ? kes(kpis.average_order_cents) : "—"}
          delta={kpis.paid_orders ? (
            <Delta current={kpis.average_order_cents} previous={prev.average_order_cents} range={range} />
          ) : <p className="text-sm mt-1 text-ink/70">No paid orders yet</p>}
        />
        <KpiTile
          label="Checkout conversion"
          Icon={TrendIcon}
          tone="lime"
          value={pct(kpis.conversion_rate)}
          hint={`${kpis.orders_created} order${kpis.orders_created === 1 ? "" : "s"} started`}
        />
        <KpiTile
          label="Paid orders"
          Icon={ReceiptIcon}
          tone="blue"
          value={kpis.paid_orders}
          delta={<Delta current={kpis.paid_orders} previous={prev.paid_orders} range={range} />}
        />
        <KpiTile
          label="New customers"
          Icon={UsersIcon}
          tone="gold"
          value={kpis.new_customers}
          delta={<Delta current={kpis.new_customers} previous={prev.new_customers} range={range} />}
        />
        <KpiTile
          label="Catalogue"
          Icon={BoxIcon}
          tone="lime"
          value={data.catalog.products}
          hint={`active products · ${data.catalog.sizes} size${data.catalog.sizes === 1 ? "" : "s"} on sale`}
        />
        <KpiTile
          label="Stock alerts"
          Icon={AlertIcon}
          tone="orange"
          value={data.todo.low_stock_sizes + data.todo.out_of_stock_sizes}
          hint={`${data.todo.out_of_stock_sizes} out · ${data.todo.low_stock_sizes} low`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          className="lg:col-span-2"
          title="Revenue per day"
          subtitle="Paid orders, by the day payment was confirmed (KES)"
        >
          <RevenueChart days={data.revenue_by_day} range={range} />
        </Card>
        <Card title="How checkouts ended" subtitle={`${totalOutcomes} order${totalOutcomes === 1 ? "" : "s"} started this period`}>
          <RankedBars
            rows={data.payment_outcomes}
            valueOf={(r) => r.count}
            labelOf={(r) => r.label}
            formatValue={(r) => `${r.count} · ${pct(r.count / totalOutcomes)}`}
            empty="No checkouts started in this period."
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Top sellers" subtitle="By revenue from paid orders">
          <RankedBars
            rows={data.top_items}
            valueOf={(r) => r.revenue_cents}
            labelOf={(r) => r.name}
            formatValue={(r) => `${kes(r.revenue_cents)} · ${r.units} sold`}
            empty="Nothing sold in this period yet."
          />
        </Card>
        <Card
          title="Low stock"
          subtitle="Sizes at or below their reorder level"
          action={<Link to="/admin/inventory" className="text-sm font-semibold text-blue-700 hover:text-ink whitespace-nowrap">Inventory →</Link>}
        >
          {data.low_stock.length === 0 ? (
            <p className="text-sm text-ink/70">Every size is above its reorder level.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-mist">
              {data.low_stock.map((v) => (
                <li key={v.variant_id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{v.product_name} — {v.label}</p>
                    <p className="text-sm text-ink/70 tabular-nums">
                      {v.stock_status === "out_of_stock" ? "Out of stock" : `${v.available} left`} · reorder at {v.reorder_level}
                    </p>
                  </div>
                  <Link
                    to={`/admin/inventory/${v.variant_id}`}
                    className="shrink-0 px-3 py-1.5 rounded-md bg-blue hover:bg-blue-400 text-ink text-xs font-semibold"
                  >
                    Receive stock
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card
          title="Coupons used"
          subtitle="On paid orders this period"
          action={<Link to="/admin/coupons" className="text-sm font-semibold text-blue-700 hover:text-ink whitespace-nowrap">Coupons →</Link>}
        >
          {data.coupon_usage.length === 0 ? (
            <p className="text-sm text-ink/70">No coupons redeemed in this period.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-mist">
              {data.coupon_usage.map((c) => (
                <li key={c.code} className="flex justify-between gap-3 py-2.5 text-sm">
                  <span className="text-ink">{c.code}</span>
                  <span className="tabular-nums text-ink">
                    {c.uses} use{c.uses === 1 ? "" : "s"} · {kes(c.discount_cents)} off
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="Recent orders"
        subtitle="Latest 8, any status"
        action={<Link to="/admin/orders" className="text-sm font-semibold text-blue-700 hover:text-ink whitespace-nowrap">All orders →</Link>}
      >
        {data.recent_orders.length === 0 ? (
          <p className="text-sm text-ink/70">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-sm text-ink/70">
                  <th className="pb-2 font-semibold">Order</th>
                  <th className="pb-2 font-semibold">Customer</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold text-right">Total</th>
                  <th className="pb-2 font-semibold text-right">Placed</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.map((o) => (
                  <tr key={o.id} className="border-t border-mist hover:bg-blue-50/60">
                    <td className="py-2.5">
                      <Link to={`/admin/orders/${o.id}`} className="text-blue-700 hover:text-ink">
                        #{o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      <span className="block text-ink">{o.customer_name || "—"}</span>
                      <span className="block text-sm text-ink/70">{o.customer_email}</span>
                    </td>
                    <td className="py-2.5"><StatusChip status={o.status} /></td>
                    <td className="py-2.5 text-right tabular-nums">{kes(o.total_cents)}</td>
                    <td className="py-2.5 text-right text-ink/70 whitespace-nowrap">
                      {new Date(`${o.created_at}Z`).toLocaleString("en-KE", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
