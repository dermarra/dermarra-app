import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import client from "../api/client";
import ProductCard from "../components/ProductCard.jsx";

const STEP_FILTERS = [
  { value: "", label: "All" },
  { value: "cleanser", label: "Cleanse" },
  { value: "serum", label: "Treat" },
  { value: "barrier_cream", label: "Repair" },
  { value: "spf", label: "Protect" },
];

export default function Shop() {
  const [searchParams] = useSearchParams();
  const concern = searchParams.get("concern") || "";
  const [products, setProducts] = useState([]);
  const [stepType, setStepType] = useState("");
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-2xl mb-4">Shop</h1>

      {concern && (
        <p className="text-sm text-ink/70 mb-4">
          Filtering by concern.{" "}
          <Link to="/shop" className="text-amber underline">
            Clear filter
          </Link>
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {STEP_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStepType(filter.value)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
              stepType === filter.value
                ? "bg-ink text-bone-light border-ink"
                : "border-mist text-ink/70"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-ink/60 text-sm">Loading products…</p>
      ) : products.length === 0 ? (
        <p className="text-ink/60 text-sm">No products yet for this filter.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
