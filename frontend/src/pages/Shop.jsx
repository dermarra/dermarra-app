import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import client from "../api/client";
import ProductCard from "../components/ProductCard.jsx";
import { containerReveal, itemReveal } from "../components/Reveal.jsx";

const STEP_FILTERS = [
  { value: "", label: "All" },
  { value: "cleanser", label: "Cleanse" },
  { value: "serum", label: "Treat" },
  { value: "barrier_cream", label: "Repair" },
  { value: "spf", label: "Protect" },
];

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [stepType, setStepType] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const params = {};
    if (stepType) params.step_type = stepType;
    client
      .get("/products", { params })
      .then(({ data }) => setProducts(data))
      .catch(() => setLoadError("Couldn't load products. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, [stepType]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:pt-16 pb-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <p className="text-sm font-semibold tracking-[0.18em] text-lime-800 uppercase mb-2">
          The full system
        </p>
        <h1 className="font-display font-semibold text-3xl sm:text-4xl text-ink mb-6">Shop all products</h1>
      </motion.div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {STEP_FILTERS.map((filter) => (
          <motion.button
            key={filter.value}
            whileTap={{ scale: 0.95 }}
            onClick={() => setStepType(filter.value)}
            className={`chip shrink-0 ${
              stepType === filter.value
                ? "chip-on"
                : "chip-off"
            }`}
          >
            {filter.label}
          </motion.button>
        ))}
      </div>

      {loading ? (
        <p className="text-ink/60 text-sm">Loading products…</p>
      ) : loadError ? (
        <p className="text-orange-700 text-sm">{loadError}</p>
      ) : products.length === 0 ? (
        <p className="text-ink/60 text-sm">No products yet for this filter.</p>
      ) : (
        <motion.div
          key={stepType}
          initial="hidden"
          animate="show"
          variants={containerReveal}
          className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {products.map((product) => (
            <motion.div key={product.id} variants={itemReveal}>
              <ProductCard product={product} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
