import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import client from "../../api/client";
import { ORDER_STATUS } from "../../lib/orderStatus.js";
import { can } from "../../lib/permissions.js";
import { useAuth } from "../../context/AuthContext";
import { containerReveal, itemReveal } from "../../components/Reveal.jsx";
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

// OrderCard is intentionally left as plain elements, not motion.* --
// @dnd-kit already drives its position via an inline `style.transform`
// during drag, and layering Framer Motion's own transform-based
// animations on the same node risks fighting that mid-drag.

const BOARD_STATUSES = ["paid", "processing", "shipped", "delivered"];

const OTHER_STATUSES = ["pending", "payment_pending", "payment_failed", "cancelled"];

const COLUMN_BAR = { paid: "bg-blue", processing: "bg-gold", shipped: "bg-lime", delivered: "bg-ink" };

const kes = (cents) => `KES ${Math.round(cents / 100).toLocaleString("en-KE")}`;
const when = (iso) => new Date(iso).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function OrderCard({ order }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
  });
  const style = { transform: CSS.Translate.toString(transform) };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white border border-mist rounded-lg p-4 touch-none cursor-grab active:cursor-grabbing hover:border-ink/30 ${
        isDragging ? "opacity-60 shadow-lg relative z-50" : ""
      }`}
    >
      <Link to={`/admin/orders/${order.id}`} className="block">
        <p className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-ink">#{order.id.slice(0, 8)}</span>
          <span className="font-semibold tabular-nums text-ink">{kes(order.total_cents)}</span>
        </p>
        <p className="mt-1 text-sm text-ink/70 truncate">{order.user_email}</p>
        <p className="mt-0.5 text-sm text-ink/70">{when(order.created_at)}</p>
      </Link>
    </div>
  );
}

function Column({ status, orders }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <motion.div
      ref={setNodeRef}
      variants={itemReveal}
      className={`flex-1 min-w-[240px] rounded-lg border bg-white/60 overflow-hidden transition-colors ${
        isOver ? "border-blue bg-blue-50" : "border-mist"
      }`}
    >
      <div className={`h-1.5 ${COLUMN_BAR[status]}`} />
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink">{ORDER_STATUS[status].label}</h3>
        <span className="min-w-[2rem] px-2 py-1 rounded-lg bg-mist text-center text-xs font-semibold tabular-nums">{orders.length}</span>
      </div>
      <div className="flex flex-col gap-2 px-3 pb-3 min-h-[6rem]">
        {orders.length === 0 && <p className="px-1 py-4 text-sm text-ink/70">Nothing here.</p>}
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </motion.div>
  );
}

export default function AdminOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = () => {
    setLoading(true);
    client
      .get("/admin/orders")
      .then(({ data }) => setOrders(data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const columns = useMemo(() => {
    const grouped = {};
    BOARD_STATUSES.forEach((s) => (grouped[s] = []));
    orders.filter((o) => matches(query, o.id, o.user_email)).forEach((o) => {
      if (grouped[o.status]) grouped[o.status].push(o);
    });
    return grouped;
  }, [orders, query]);

  const filteredList = useMemo(
    () => (filter ? orders.filter((o) => o.status === filter && matches(query, o.id, o.user_email)) : []),
    [orders, filter, query]
  );

  const handleDragEnd = async ({ active, over }) => {
    if (!over) return;
    const order = orders.find((o) => o.id === active.id);
    if (!order) return;

    const fromIndex = BOARD_STATUSES.indexOf(order.status);
    const toIndex = BOARD_STATUSES.indexOf(over.id);
    if (toIndex === -1 || toIndex === fromIndex) return;

    if (toIndex !== fromIndex + 1) {
      setError("Orders can only move one step forward at a time (Paid, then Processing, Shipped and Delivered).");
      return;
    }

    if (over.id === "delivered") {
      // Delivery requires a proof-of-delivery photo, which can't be given
      // by dragging -- this used to always fail against the API.
      setError("To mark an order delivered, open it and upload the proof-of-delivery photo.");
      return;
    }

    setError(null);
    const newStatus = over.id;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o)));
    try {
      const { data } = await client.post(`/admin/orders/${order.id}/advance`, { status: newStatus });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data : o)));
    } catch (err) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
      setError(err.response?.data?.error || "Couldn't advance this order.");
    }
  };

  const mayFulfil = can(user, "orders.fulfil");
  const countOf = (status) => orders.filter((o) => o.status === status).length;
  const onBoard = orders.filter((o) => BOARD_STATUSES.includes(o.status)).length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <PageHeader
        title="Orders"
        description="Paid orders move along the board as you pack and send them. Drag a card one column right, or open it to add tracking and the delivery photo."
      >
        <Toolbar>
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: "", label: "Board", count: onBoard },
              ...OTHER_STATUSES.map((st) => ({
                value: st,
                label: ORDER_STATUS[st].label,
                count: countOf(st),
                countTone: st === "payment_pending" || st === "payment_failed" ? "warn" : undefined,
              })),
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="Search order number or email" />
        </Toolbar>
      </PageHeader>

      {error && <p className="mb-4 px-4 py-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">{error}</p>}

      {loading ? (
        <LoadingState>Loading orders…</LoadingState>
      ) : filter ? (
        filteredList.length === 0 ? (
          <EmptyState>No orders here.</EmptyState>
        ) : (
          <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
            {filteredList.map((order, index) => (
              <ListRow
                key={order.id}
                thumb={<Thumb name={order.user_email} index={index} round />}
                title={`#${order.id.slice(0, 8)}`}
                subtitle={order.user_email}
                stats={[
                  { label: "Total", value: kes(order.total_cents) },
                  { label: "Placed", value: when(order.created_at) },
                ]}
                badge={<StatusBadge tone={ORDER_STATUS[order.status]?.tone}>{ORDER_STATUS[order.status]?.label || order.status}</StatusBadge>}
                actions={<Button to={`/admin/orders/${order.id}`}>Open</Button>}
              />
            ))}
          </motion.div>
        )
      ) : (
        <DndContext sensors={mayFulfil ? sensors : undefined} onDragEnd={mayFulfil ? handleDragEnd : undefined}>
          <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex gap-3 overflow-x-auto pb-4">
            {BOARD_STATUSES.map((status) => (
              <Column key={status} status={status} orders={columns[status]} />
            ))}
          </motion.div>
        </DndContext>
      )}
    </motion.div>
  );
}
