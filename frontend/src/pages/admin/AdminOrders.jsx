import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

const BOARD_STATUSES = ["paid", "processing", "shipped", "delivered"];
const BOARD_LABELS = { paid: "Paid", processing: "Processing", shipped: "Shipped", delivered: "Delivered" };

const OTHER_FILTERS = [
  { value: "", label: "Board" },
  { value: "pending", label: "Pending" },
  { value: "payment_pending", label: "Awaiting payment" },
  { value: "cancelled", label: "Cancelled" },
  { value: "payment_failed", label: "Payment failed" },
];

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
      className={`border border-mist rounded-sm bg-bone-light p-3 mb-2 touch-none cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50 shadow-lg relative z-50" : ""
      }`}
    >
      <Link to={`/admin/orders/${order.id}`} className="block">
        <p className="text-xs font-mono font-semibold text-ink">{order.id.slice(0, 8)}</p>
        <p className="text-xs text-ink/60 truncate">{order.user_email}</p>
        <p className="text-sm text-ink mt-1">
          {order.currency} {(order.total_cents / 100).toFixed(0)}
        </p>
      </Link>
    </div>
  );
}

function Column({ status, orders }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[220px] border rounded-sm p-3 ${
        isOver ? "border-amber bg-amber-light/10" : "border-mist"
      }`}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/70 mb-3">
        {BOARD_LABELS[status]} · {orders.length}
      </h3>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
    orders.forEach((o) => {
      if (grouped[o.status]) grouped[o.status].push(o);
    });
    return grouped;
  }, [orders]);

  const filteredList = useMemo(
    () => (filter ? orders.filter((o) => o.status === filter) : []),
    [orders, filter]
  );

  const handleDragEnd = async ({ active, over }) => {
    if (!over) return;
    const order = orders.find((o) => o.id === active.id);
    if (!order) return;

    const fromIndex = BOARD_STATUSES.indexOf(order.status);
    const toIndex = BOARD_STATUSES.indexOf(over.id);
    if (toIndex === -1 || toIndex === fromIndex) return;

    if (toIndex !== fromIndex + 1) {
      setError("Orders can only move one step forward at a time (Paid → Processing → Shipped → Delivered).");
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

  return (
    <div>
      <h2 className="font-display text-xl mb-4">Orders</h2>

      <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {OTHER_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
              filter === f.value ? "bg-ink text-bone-light border-ink" : "border-mist text-ink/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-clay mb-4">{error}</p>}

      {loading ? (
        <p className="text-ink/60 text-sm">Loading orders…</p>
      ) : filter ? (
        filteredList.length === 0 ? (
          <p className="text-ink/60 text-sm">No orders for this filter.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredList.map((order) => (
              <Link
                key={order.id}
                to={`/admin/orders/${order.id}`}
                className="flex items-center justify-between border border-mist rounded-sm px-4 py-3 hover:border-ink/40"
              >
                <div>
                  <p className="text-sm font-semibold text-ink font-mono">{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-ink/60">
                    {order.user_email} · {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-ink">
                    {order.currency} {(order.total_cents / 100).toFixed(0)}
                  </p>
                  <p className="text-xs font-mono uppercase text-ink/60">{order.status}</p>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {BOARD_STATUSES.map((status) => (
              <Column key={status} status={status} orders={columns[status]} />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}
