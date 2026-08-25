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

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (stepType) params.step_type = stepType;
    client
      .get("/products", { params })
      .then(({ data }) => setProducts(data))
      .finally(() => setLoading(false));
  }, [stepType]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <p className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-2">
          The full system
        </p>
        <h1 className="font-display text-2xl sm:text-3xl text-ink mb-6">Shop all products</h1>
      </motion.div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {STEP_FILTERS.map((filter) => (
          <motion.button
            key={filter.value}
            whileTap={{ scale: 0.95 }}
            onClick={() => setStepType(filter.value)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
              stepType === filter.value
                ? "bg-ink text-bone-light border-ink"
                : "border-mist text-ink/70"
            }`}
          >
            {filter.label}
          </motion.button>
        ))}
      </div>

      {loading ? (
        <p className="text-ink/60 text-sm">Loading products…</p>
      ) : products.length === 0 ? (
        <p className="text-ink/60 text-sm">No products yet for this filter.</p>
      ) : (
        <motion.div
          key={stepType}
          initial="hidden"
          animate="show"
          variants={containerReveal}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
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
