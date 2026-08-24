import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import client from "../../api/client";
import { containerReveal, itemReveal } from "../../components/Reveal.jsx";

const STATUS_LABELS = {
  pending: "Pending",
  payment_pending: "Awaiting payment",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_failed: "Payment failed",
};

function formatKES(cents) {
  return `KES ${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-mist bg-bone-light px-3 py-2 text-xs shadow-sm">
      <p className="text-ink/60 mb-1">{label}</p>
      <p className="font-semibold text-ink">{formatter(payload[0].value)}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    client
      .get("/admin/dashboard")
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.error || "Couldn't load dashboard data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-ink/60 text-sm">Loading dashboard…</p>;
  if (error) return <p className="text-sm text-clay">{error}</p>;
  if (!data) return null;

  const totalOrders = Object.values(data.order_counts_by_status || {}).reduce((a, b) => a + b, 0);
  const revenueByDay = (data.revenue_by_day || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    revenue: d.revenue_cents / 100,
  }));
  const ordersByStatus = Object.entries(data.order_counts_by_status || {}).map(([status, count]) => ({
    status: STATUS_LABELS[status] || status,
    count,
  }));

  return (
    <div className="flex flex-col gap-8">
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="font-display text-xl text-ink"
      >
        Dashboard
      </motion.h2>

      <motion.div
        initial="hidden"
        animate="show"
        variants={containerReveal}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <motion.div variants={itemReveal} className="border border-mist rounded-sm p-4">
          <p className="text-xs text-ink/60 uppercase tracking-wide font-mono">Total revenue</p>
          <p className="font-display text-2xl text-ink mt-1">{formatKES(data.total_revenue_cents)}</p>
        </motion.div>
        <motion.div variants={itemReveal} className="border border-mist rounded-sm p-4">
          <p className="text-xs text-ink/60 uppercase tracking-wide font-mono">Total orders</p>
          <p className="font-display text-2xl text-ink mt-1">{totalOrders}</p>
        </motion.div>
      </motion.div>

      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Inventory</h3>
        <motion.div
          initial="hidden"
          animate="show"
          variants={containerReveal}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          <motion.div variants={itemReveal} className="border border-mist rounded-sm p-4">
            <p className="text-xs text-ink/60 uppercase tracking-wide font-mono">Total products</p>
            <p className="font-display text-2xl text-ink mt-1">{data.total_products}</p>
          </motion.div>
          <Link to="/admin/inventory?status=low_stock">
            <motion.div variants={itemReveal} className="border border-mist rounded-sm p-4 hover:border-ink/40 transition-colors">
              <p className="text-xs text-ink/60 uppercase tracking-wide font-mono">Low stock</p>
              <p className="font-display text-2xl text-amber-dark mt-1">{data.low_stock_count}</p>
            </motion.div>
          </Link>
          <Link to="/admin/inventory?status=out_of_stock">
            <motion.div variants={itemReveal} className="border border-mist rounded-sm p-4 hover:border-ink/40 transition-colors">
              <p className="text-xs text-ink/60 uppercase tracking-wide font-mono">Out of stock</p>
              <p className="font-display text-2xl text-clay mt-1">{data.out_of_stock_count}</p>
            </motion.div>
          </Link>
          <motion.div variants={itemReveal} className="border border-mist rounded-sm p-4">
            <p className="text-xs text-ink/60 uppercase tracking-wide font-mono">Expiring soon</p>
            <p className="font-display text-2xl text-ink mt-1">{data.expiring_soon_count}</p>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={containerReveal}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <motion.div variants={itemReveal} className="border border-mist rounded-sm p-4">
          <h3 className="text-sm font-semibold text-ink mb-4">Revenue, last 30 days</h3>
          {revenueByDay.length === 0 ? (
            <p className="text-xs text-ink/60">No revenue yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#84C665" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#84C665" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ECECEB" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#64615A" }}
                  axisLine={{ stroke: "#ECECEB" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64615A" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip formatter={(v) => `KES ${v.toLocaleString()}`} />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#63954C"
                  strokeWidth={2}
                  fill="url(#revenueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div variants={itemReveal} className="border border-mist rounded-sm p-4">
          <h3 className="text-sm font-semibold text-ink mb-4">Orders by status</h3>
          {ordersByStatus.length === 0 ? (
            <p className="text-xs text-ink/60">No orders yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ordersByStatus} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#ECECEB" vertical={false} />
                <XAxis
                  dataKey="status"
                  tick={{ fontSize: 10, fill: "#64615A" }}
                  axisLine={{ stroke: "#ECECEB" }}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis hide />
                <Tooltip content={<ChartTooltip formatter={(v) => `${v} order${v === 1 ? "" : "s"}`} />} />
                <Bar dataKey="count" fill="#F47A53" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  <LabelList dataKey="count" position="top" style={{ fill: "#64615A", fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </motion.div>

      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Recent activity</h3>
        {(data.recent_activity || []).length === 0 ? (
          <p className="text-xs text-ink/60">No recent orders.</p>
        ) : (
          <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-2">
            {data.recent_activity.map((order) => (
              <motion.div key={order.id} variants={itemReveal}>
              <Link
                to={`/admin/orders/${order.id}`}
                className="flex items-center justify-between border border-mist rounded-sm px-4 py-3 hover:border-ink/40 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-ink font-mono">{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-ink/60">
                    {order.user_email} · {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-ink">{formatKES(order.total_cents)}</p>
                  <p className="text-xs font-mono uppercase text-ink/60">{order.status}</p>
                </div>
              </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
