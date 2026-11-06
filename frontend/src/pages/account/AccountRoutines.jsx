import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import client, { cloudinaryUrl } from "../../api/client";
import { useCart } from "../../context/CartContext";
import RoutineStepRail from "../../components/RoutineStepRail.jsx";

// Mirrors the backend's own definition of "never reached a successful
// payment" (see admin.py's _UNPAID_STATUSES) -- only orders that got past
// this count as an actual purchase.
const UNPAID_STATUSES = new Set(["pending", "payment_pending", "payment_failed", "cancelled"]);

export default function AccountRoutines() {
  const { addItem } = useCart();
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addedId, setAddedId] = useState(null);
  const [error, setError] = useState(null);
  const [reorderError, setReorderError] = useState({});

  useEffect(() => {
    Promise.all([client.get("/orders"), client.get("/routines")]).then(
      ([ordersRes, routinesRes]) => {
        const purchasedIds = new Set();
        ordersRes.data.forEach((order) => {
          if (UNPAID_STATUSES.has(order.status)) return;
          order.items.forEach((item) => {
            if (item.routine_id) purchasedIds.add(item.routine_id);
          });
        });
        setRoutines(routinesRes.data.filter((r) => purchasedIds.has(r.id)));
      }
    )
      .catch(() => setError("Couldn't load your routines -- please refresh to try again."))
      .finally(() => setLoading(false));
  }, []);

  const reorder = async (routine) => {
    setReorderError((e) => ({ ...e, [routine.id]: null }));
    try {
      await addItem({ routineId: routine.id });
      setAddedId(routine.id);
      setTimeout(() => setAddedId(null), 2000);
    } catch (err) {
      setReorderError((e) => ({
        ...e,
        [routine.id]: err.response?.data?.error || "Couldn't add this routine to your cart.",
      }));
    }
  };

  if (loading) return <p className="text-sm text-ink/60">Loading your routines…</p>;
  if (error) return <p className="text-sm text-orange-700">{error}</p>;

  if (routines.length === 0) {
    return (
      <div className="border border-mist rounded-sm bg-bone-light p-6 text-center">
        <p className="text-sm text-ink/60">You haven&apos;t purchased a routine yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {routines.map((routine) => {
        const routineImageUrl = cloudinaryUrl(routine.cloudinary_public_id, { width: 160 });
        return (
        <motion.div
          key={routine.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="border border-mist rounded-sm bg-bone-light p-5"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-sm bg-mist overflow-hidden shrink-0">
                {routineImageUrl && (
                  <img src={routineImageUrl} alt={routine.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div>
                <h3 className="font-display text-xl text-ink">{routine.name}</h3>
                {routine.tagline && <p className="text-sm text-ink/70 mt-1">{routine.tagline}</p>}
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => reorder(routine)}
              className="shrink-0 px-4 py-2 rounded-full bg-orange text-ink text-xs font-semibold whitespace-nowrap"
            >
              {addedId === routine.id ? "Added ✓" : "Reorder"}
            </motion.button>
          </div>
          {reorderError[routine.id] && <p className="text-sm text-orange-700 mb-3">{reorderError[routine.id]}</p>}
          <RoutineStepRail steps={routine.steps} />
        </motion.div>
        );
      })}
    </div>
  );
}
