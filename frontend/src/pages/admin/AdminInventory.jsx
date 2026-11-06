import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import client from "../../api/client";
import { containerReveal } from "../../components/Reveal.jsx";
import {
  Button,
  EmptyState,
  ErrorText,
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

const STATUS = {
  in_stock: { label: "In stock", tone: "good" },
  low_stock: { label: "Low stock", tone: "warn" },
  out_of_stock: { label: "Out of stock", tone: "bad" },
  no_sizes: { label: "No sizes", tone: "warn" },
};

export default function AdminInventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expiringSoon, setExpiringSoon] = useState([]);

  const [query, setQuery] = useState("");

  const load = () => {
    setLoading(true);
    setError(null);
    client
      .get("/admin/inventory")
      .then(({ data }) => setRows(data))
      .catch((err) => setError(err.response?.data?.error || "Couldn't load inventory."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const setStatusFilter = (value) => setSearchParams(value ? { status: value } : {});

  useEffect(() => {
    client
      .get("/admin/inventory/expiring-soon", { params: { days: 30 } })
      .then(({ data }) => setExpiringSoon(data))
      .catch(() => {});
  }, []);

  const count = (status) => rows.filter((r) => r.stock_status === status).length;
  const shown = rows.filter(
    (r) => (statusFilter === "" || r.stock_status === statusFilter) && matches(query, r.product_name, r.label, r.sku)
  );
  const fmt = (n) => Number(n).toLocaleString("en-KE");

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <PageHeader
        title="Inventory"
        description="Stock for every size. A size is low when what's available drops to its reorder level."
      >
        <Toolbar>
          <FilterTabs
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "", label: "All", count: rows.length },
              { value: "low_stock", label: "Low stock", count: count("low_stock"), countTone: "warn" },
              { value: "out_of_stock", label: "Out of stock", count: count("out_of_stock"), countTone: "warn" },
              ...(count("no_sizes") ? [{ value: "no_sizes", label: "No sizes", count: count("no_sizes"), countTone: "warn" }] : []),
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="Search products or sizes" />
        </Toolbar>
      </PageHeader>

      {expiringSoon.length > 0 && (
        <section className="mb-6 p-5 bg-orange-50 border border-orange-200 rounded-lg">
          <h3 className="text-xl font-semibold text-ink">Expiring within 30 days</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {expiringSoon.map((batch) => (
              <li key={batch.id} className="text-ink/80">
                {batch.product_name} ({batch.variant_label}): batch {batch.batch_number}, {batch.quantity_remaining} units, expires{" "}
                {batch.expiry_date}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <LoadingState>Loading inventory…</LoadingState>
      ) : shown.length === 0 ? (
        <EmptyState>{rows.length ? "Nothing matches this filter." : "No products yet."}</EmptyState>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {shown.map((row, index) => {
            const status = STATUS[row.stock_status] || STATUS.no_sizes;
            const hasSize = !!row.id;
            return (
              <ListRow
                key={row.id || `product-${row.product_id}`}
                thumb={<Thumb imageId={row.cloudinary_public_id} name={row.product_name} index={index} />}
                title={row.product_name}
                subtitle={hasSize ? row.label : "Hidden from the shop until it has a size"}
                statCols={4}
                stats={
                  hasSize
                    ? [
                        { label: "On hand", value: fmt(row.on_hand) },
                        { label: "Reserved", value: fmt(row.reserved) },
                        { label: "Available", value: fmt(row.available), tone: row.stock_status !== "in_stock" ? "warn" : undefined },
                        { label: "Reorder at", value: fmt(row.reorder_level) },
                      ]
                    : []
                }
                badge={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
                actions={
                  hasSize ? (
                    <Button to={`/admin/inventory/${row.id}`}>Manage</Button>
                  ) : (
                    <Button variant="secondary" to={`/admin/products?edit=${row.product_id}`}>
                      Add a size
                    </Button>
                  )
                }
              />
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
