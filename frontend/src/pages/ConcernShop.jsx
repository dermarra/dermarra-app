import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import client, { cloudinaryUrl } from "../api/client";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import ProductCard from "../components/ProductCard.jsx";
import RoutineStepRail from "../components/RoutineStepRail.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import { containerReveal, itemReveal } from "../components/Reveal.jsx";

const STEP_FILTERS = [
  { value: "", label: "All" },
  { value: "cleanser", label: "Cleanse" },
  { value: "serum", label: "Treat" },
  { value: "barrier_cream", label: "Repair" },
  { value: "spf", label: "Protect" },
];

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "Name" },
];

const PAGE_SIZE = 8;

export default function ConcernShop() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [concern, setConcern] = useState(null);
  const [products, setProducts] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [stepType, setStepType] = useState("");
  const [sort, setSort] = useState("featured");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [addedRoutineId, setAddedRoutineId] = useState(null);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setVisibleCount(PAGE_SIZE);
    Promise.all([
      client.get("/products/concerns"),
      client.get("/products", { params: { concern: slug } }),
      client.get("/routines"),
    ])
      .then(([concernsRes, productsRes, routinesRes]) => {
        const match = concernsRes.data.find((c) => c.slug === slug);
        if (!match) {
          setNotFound(true);
        } else {
          setConcern(match);
        }
        setProducts(productsRes.data);
        setRoutines(routinesRes.data.filter((r) => r.primary_concern?.slug === slug));
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const visibleProducts = useMemo(() => {
    let list = stepType ? products.filter((p) => p.step_type === stepType) : products;
    const sorted = [...list].sort((a, b) => {
      if (sort === "price_asc") return a.price_cents - b.price_cents;
      if (sort === "price_desc") return b.price_cents - a.price_cents;
      if (sort === "name") return a.name.localeCompare(b.name);
      return 0; // featured -- keep server order
    });
    return sorted;
  }, [products, stepType, sort]);

  const addRoutineToCart = async (routineId) => {
    if (!user) return;
    try {
      await addItem({ routineId });
      setAddedRoutineId(routineId);
      setTimeout(() => setAddedRoutineId(null), 1800);
    } catch {
      // swallowed -- the routine's own detail flow isn't built yet, this
      // is a lightweight shortcut matching ProductCard's own error handling
    }
  };

  if (loading) return <p className="p-4 text-sm text-ink/60">Loading…</p>;

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-ink/70">We couldn&apos;t find that concern.</p>
        <Link to="/shop" className="inline-block mt-4 px-5 py-3 rounded-sm bg-amber text-bone-light font-semibold">
          Shop all products
        </Link>
      </div>
    );
  }

  const heroImageUrl = cloudinaryUrl(concern.cloudinary_public_id, { width: 1200 });

  return (
    <div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative bg-mist overflow-hidden"
      >
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20 relative z-10">
          <Breadcrumbs
            items={[{ label: "Home", to: "/" }, { label: "Shop", to: "/shop" }, { label: concern.name }]}
          />
          <p className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-2">
            Shop by concern
          </p>
          <h1 className="font-display text-3xl sm:text-4xl text-ink max-w-lg">{concern.name}</h1>
          {concern.description && (
            <p className="text-ink/70 mt-3 max-w-md">{concern.description}</p>
          )}
        </div>
        {heroImageUrl && (
          <img
            src={heroImageUrl}
            alt={concern.name}
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
        )}
      </motion.div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {routines.length > 0 && (
          <div className="mb-10">
            <h2 className="font-display text-xl text-ink mb-4">Routines for {concern.name.toLowerCase()}</h2>
            <div className="flex flex-col gap-4">
              {routines.map((routine) => {
                const routineImageUrl = cloudinaryUrl(routine.cloudinary_public_id, { width: 160 });
                return (
                  <div
                    key={routine.id}
                    className="rounded-sm border border-mist bg-bone-light p-5"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-sm bg-mist overflow-hidden shrink-0">
                          {routineImageUrl && (
                            <img src={routineImageUrl} alt={routine.name} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-display text-lg text-ink">{routine.name}</h3>
                          {routine.tagline && <p className="text-sm text-ink/70 mt-1">{routine.tagline}</p>}
                        </div>
                      </div>
                      {user ? (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => addRoutineToCart(routine.id)}
                          className="shrink-0 px-4 py-2 rounded-sm bg-amber text-bone-light text-xs font-semibold hover:bg-amber-dark transition-colors whitespace-nowrap"
                        >
                          {addedRoutineId === routine.id
                            ? "Added to cart"
                            : `Add to cart${routine.bundle_discount_percent > 0 ? ` · Save ${routine.bundle_discount_percent}%` : ""}`}
                        </motion.button>
                      ) : (
                        <Link
                          to="/login"
                          className="shrink-0 px-4 py-2 rounded-sm bg-amber text-bone-light text-xs font-semibold hover:bg-amber-dark transition-colors whitespace-nowrap"
                        >
                          Sign in to add
                        </Link>
                      )}
                    </div>
                    <RoutineStepRail steps={routine.steps} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <h2 className="font-display text-xl text-ink mb-4">Products</h2>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            {STEP_FILTERS.map((f) => (
              <motion.button
                key={f.value}
                whileTap={{ scale: 0.95 }}
                onClick={() => setStepType(f.value)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
                  stepType === f.value ? "bg-ink text-bone-light border-ink" : "border-mist text-ink/70"
                }`}
              >
                {f.label}
              </motion.button>
            ))}
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-mist rounded-sm px-3 py-2 text-sm bg-bone text-ink self-start sm:self-auto"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
        </div>

        {visibleProducts.length === 0 ? (
          <p className="text-ink/60 text-sm">No products yet for this filter.</p>
        ) : (
          <>
            <motion.div
              key={`${stepType}-${sort}`}
              initial="hidden"
              animate="show"
              variants={containerReveal}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
            >
              {visibleProducts.slice(0, visibleCount).map((product) => (
                <motion.div key={product.id} variants={itemReveal}>
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </motion.div>

            {visibleCount < visibleProducts.length && (
              <div className="flex justify-center mt-8">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="px-6 py-3 rounded-sm border border-mist text-ink/70 text-sm font-semibold"
                >
                  Load more
                </motion.button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
