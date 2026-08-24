import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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

function ShopByHub({ concerns, ingredients }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 border-y border-mist py-8 mb-8">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/70 mb-3 pb-2 border-b border-mist">
          Shop by concern
        </h2>
        <ul className="flex flex-col gap-2">
          {concerns.map((c) => (
            <li key={c.id}>
              <Link to={`/shop/concern/${c.slug}`} className="text-sm text-ink hover:text-amber transition-colors">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/70 mb-3 pb-2 border-b border-mist">
          Shop by ingredients
        </h2>
        {ingredients.length === 0 ? (
          <p className="text-sm text-ink/50">None added yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ingredients.map((i) => (
              <li key={i.id}>
                <Link to={`/shop/ingredient/${i.slug}`} className="text-sm text-ink hover:text-amber transition-colors">
                  {i.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Shop() {
  const [searchParams] = useSearchParams();
  const concern = searchParams.get("concern") || "";
  const [products, setProducts] = useState([]);
  const [stepType, setStepType] = useState("");
  const [loading, setLoading] = useState(true);
  const [concerns, setConcerns] = useState([]);
  const [ingredients, setIngredients] = useState([]);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (stepType) params.step_type = stepType;
    if (concern) params.concern = concern;
    client
      .get("/products", { params })
      .then(({ data }) => setProducts(data))
      .finally(() => setLoading(false));
  }, [stepType, concern]);

  useEffect(() => {
    client.get("/products/concerns").then(({ data }) => setConcerns(data));
    client.get("/products/ingredients").then(({ data }) => setIngredients(data));
  }, []);

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
        <h1 className="font-display text-2xl sm:text-3xl text-ink mb-4">Shop</h1>
      </motion.div>

      <ShopByHub concerns={concerns} ingredients={ingredients} />

      <h2 className="font-display text-xl text-ink mb-4">All products</h2>

      <AnimatePresence>
        {concern && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-sm text-ink/70 mb-4"
          >
            Filtering by concern.{" "}
            <Link to="/shop" className="text-amber underline">
              Clear filter
            </Link>
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
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
          key={`${stepType}-${concern}`}
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
