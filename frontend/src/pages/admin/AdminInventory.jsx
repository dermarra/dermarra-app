import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import client from "../../api/client";
import { containerReveal, itemReveal } from "../../components/Reveal.jsx";

const STATUS_LABELS = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

const STATUS_STYLES = {
  in_stock: "border-sage text-sage-dark",
  low_stock: "border-amber text-amber-dark",
  out_of_stock: "border-clay text-clay",
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

export default function AdminInventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expiringSoon, setExpiringSoon] = useState([]);

  const load = () => {
    setLoading(true);
    setError(null);
    const params = statusFilter ? { status: statusFilter } : {};
    client
      .get("/admin/inventory", { params })
      .then(({ data }) => setRows(data))
      .catch((err) => setError(err.response?.data?.error || "Couldn't load inventory."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter]);

  const setStatusFilter = (value) => setSearchParams(value ? { status: value } : {});

  useEffect(() => {
    client.get("/admin/inventory/expiring-soon", { params: { days: 30 } }).then(({ data }) => setExpiringSoon(data));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-ink">Inventory</h2>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                statusFilter === f.value ? "bg-ink text-bone-light border-ink" : "border-mist text-ink/70"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <section className="border border-amber/60 bg-amber-light/10 rounded-sm p-4">
          <h3 className="text-sm font-semibold text-ink mb-2">Expiring within 30 days</h3>
          <div className="flex flex-col gap-1">
            {expiringSoon.map((batch) => (
              <p key={batch.id} className="text-xs text-ink/70">
                {batch.product_name} — batch {batch.batch_number} ({batch.quantity_remaining} units) expires{" "}
                {batch.expiry_date}
              </p>
            ))}
          </div>
        </section>
      )}

      {error && <p className="text-sm text-clay">{error}</p>}

      {loading ? (
        <p className="text-ink/60 text-sm">Loading inventory…</p>
      ) : rows.length === 0 ? (
        <p className="text-ink/60 text-sm">No products match this filter.</p>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-2">
          {rows.map((row) => (
            <motion.div key={row.id} variants={itemReveal}>
              <Link
                to={`/admin/inventory/${row.id}`}
                className="flex items-center justify-between border border-mist rounded-sm px-4 py-3 hover:border-ink/40 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{row.name}</p>
                  <p className="text-xs text-ink/60 font-mono">
                    on hand {row.on_hand} · reserved {row.reserved} · available {row.available} · reorder at{" "}
                    {row.reorder_level}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs font-semibold uppercase tracking-wide border rounded-full px-3 py-1 ${STATUS_STYLES[row.stock_status]}`}
                >
                  {STATUS_LABELS[row.stock_status]}
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
