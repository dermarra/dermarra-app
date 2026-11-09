import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
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
  const [routineAddError, setRoutineAddError] = useState({});
  const [loadError, setLoadError] = useState(null);
  const location = useLocation();

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setLoadError(null);
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
      .catch(() => setLoadError("Couldn't load this page -- check your connection and try again."))
      .finally(() => setLoading(false));
  }, [slug]);

  const visibleProducts = useMemo(() => {
    let list = stepType ? products.filter((p) => p.step_type === stepType) : products;
    const sorted = [...list].sort((a, b) => {
      if (sort === "price_asc") return a.price_from_cents - b.price_from_cents;
      if (sort === "price_desc") return b.price_from_cents - a.price_from_cents;
      if (sort === "name") return a.name.localeCompare(b.name);
      return 0; // featured -- keep server order
    });
    return sorted;
  }, [products, stepType, sort]);

  const addRoutineToCart = async (routineId) => {
    if (!user) return;
    setRoutineAddError((e) => ({ ...e, [routineId]: null }));
    try {
      await addItem({ routineId });
      setAddedRoutineId(routineId);
      setTimeout(() => setAddedRoutineId(null), 1800);
    } catch (err) {
      setRoutineAddError((e) => ({
        ...e,
        [routineId]: err.response?.data?.error || "Couldn't add this routine -- please try again.",
      }));
    }
  };

  if (loading) return <p className="p-4 text-sm text-ink/60">Loading…</p>;

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-14 sm:pt-20 pb-12 text-center">
        <p className="text-ink/70">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary mt-4"
        >
          Try again
        </button>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-14 sm:pt-20 pb-12 text-center">
        <p className="text-ink/70">We couldn&apos;t find that concern.</p>
        <Link to="/shop" className="btn btn-primary mt-4">
          Shop all products
        </Link>
      </div>
    );
  }

  const heroImageUrl = cloudinaryUrl(concern.cloudinary_public_id, { width: 1400 });
  const resultLabel = `${visibleProducts.length} ${visibleProducts.length === 1 ? "product" : "products"}`;

  // Layout after The Ordinary's concern pages (owner, 2026-11-10): crumb,
  // a split banner (the concern explained beside its photo), then a quiet
  // toolbar and the product grid; the matching routine closes the page.
  return (
    <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 pt-6 sm:pt-8 pb-16">
      <Breadcrumbs items={[{ label: "Shop", to: "/shop" }, { label: concern.name }]} />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="mt-4 grid lg:grid-cols-2 rounded-lg overflow-hidden bg-bone-light"
      >
        <div className="order-2 lg:order-1 flex flex-col justify-center px-6 sm:px-10 lg:px-14 py-10 lg:py-16">
          <p className="text-sm font-semibold tracking-[0.18em] text-lime-800 uppercase mb-3">Skin concern</p>
          <h1 className="font-display font-semibold text-4xl sm:text-5xl leading-[1.05] text-ink">{concern.name}</h1>
          {concern.description && <p className="mt-5 text-ink/80 leading-relaxed max-w-xl">{concern.description}</p>}
          {routines.length > 0 && (
            <a href="#concern-routine" className="mt-8 self-start btn btn-secondary">
              See the complete routine
            </a>
          )}
        </div>
        <div className="order-1 lg:order-2 relative aspect-[4/3] lg:aspect-auto lg:min-h-[440px] bg-mist">
          {heroImageUrl ? (
            <img src={heroImageUrl} alt={concern.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <img src="/brand/icon-dark.svg" alt="" className="w-1/3 h-auto" />
            </span>
          )}
        </div>
      </motion.section>

      <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2 overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
            {STEP_FILTERS.map((f) => (
              <motion.button
                key={f.value}
                whileTap={{ scale: 0.95 }}
                onClick={() => setStepType(f.value)}
                className={`chip shrink-0 ${stepType === f.value ? "chip-on" : "chip-off"}`}
              >
                {f.label}
              </motion.button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="field w-auto h-11 pr-10" aria-label="Sort products">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-ink/70 text-sm" aria-live="polite">
          {resultLabel}
        </p>
      </div>

        {visibleProducts.length === 0 ? (
          <p className="text-ink/70">No products yet for this filter.</p>
        ) : (
          <>
            <motion.div
              key={`${stepType}-${sort}`}
              initial="hidden"
              animate="show"
              variants={containerReveal}
              className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
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
                  className="btn btn-secondary"
                >
                  Load more
                </motion.button>
              </div>
            )}
          </>
        )}

      {routines.length > 0 && (
        <section id="concern-routine" className="mt-16 scroll-mt-28">
          <h2 className="font-display font-semibold text-3xl sm:text-4xl text-ink mb-2">The complete routine</h2>
          <p className="text-ink/70 mb-6 max-w-2xl">
            Every step for {concern.name.toLowerCase()}, in the right order -- add it as one bundle.
          </p>
          <div className="flex flex-col gap-4">
            {routines.map((routine) => {
              const routineImageUrl = cloudinaryUrl(routine.cloudinary_public_id, { width: 160 });
              return (
                <div key={routine.id} className="rounded-lg border border-mist bg-bone-light p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-lg bg-mist overflow-hidden shrink-0">
                        {routineImageUrl && <img src={routineImageUrl} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <h3 className="text-2xl font-semibold text-ink">{routine.name}</h3>
                        {routine.tagline && <p className="text-ink/70 mt-1">{routine.tagline}</p>}
                      </div>
                    </div>
                    {user ? (
                      <button type="button" onClick={() => addRoutineToCart(routine.id)} className="btn btn-primary shrink-0 self-start">
                        {addedRoutineId === routine.id
                          ? "Added to cart"
                          : `Add routine to cart${routine.bundle_discount_percent > 0 ? ` · Save ${routine.bundle_discount_percent}%` : ""}`}
                      </button>
                    ) : (
                      <Link to="/login" state={{ from: location.pathname }} className="btn btn-primary shrink-0 self-start">
                        Sign in to add the routine
                      </Link>
                    )}
                  </div>
                  {routineAddError[routine.id] && <p className="text-orange-700 mb-3">{routineAddError[routine.id]}</p>}
                  <RoutineStepRail steps={routine.steps} />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
