import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import client, { cloudinaryUrl } from "../api/client";
import ProductCard from "../components/ProductCard.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import { containerReveal, itemReveal } from "../components/Reveal.jsx";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "Name" },
];

const PAGE_SIZE = 8;

export default function StepShop() {
  const { key } = useParams();
  const [group, setGroup] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sort, setSort] = useState("featured");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setVisibleCount(PAGE_SIZE);
    client.get("/products/step-groups").then(({ data }) => {
      const match = data.find((g) => g.key === key);
      if (!match) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setGroup(match);
      client
        .get("/products", { params: { step_type: match.step_type } })
        .then(({ data: productsData }) => setProducts(productsData))
        .finally(() => setLoading(false));
    });
  }, [key]);

  const visibleProducts = useMemo(() => {
    const sorted = [...products].sort((a, b) => {
      if (sort === "price_asc") return a.price_cents - b.price_cents;
      if (sort === "price_desc") return b.price_cents - a.price_cents;
      if (sort === "name") return a.name.localeCompare(b.name);
      return 0; // featured -- keep server order
    });
    return sorted;
  }, [products, sort]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-ink/70">We couldn&apos;t find that step.</p>
        <Link to="/shop" className="inline-block mt-4 px-5 py-3 rounded-sm bg-amber text-bone-light font-semibold">
          Shop all products
        </Link>
      </div>
    );
  }

  if (loading) return <p className="p-4 text-sm text-ink/60">Loading…</p>;

  const heroImageUrl = cloudinaryUrl(group.cloudinary_public_id, { width: 1200 });

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
            items={[{ label: "Home", to: "/" }, { label: "Shop", to: "/shop" }, { label: group.label }]}
          />
          <p className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-2">
            Shop by step
          </p>
          <h1 className="font-display text-3xl sm:text-4xl text-ink max-w-lg">{group.label}</h1>
          {group.description && (
            <p className="text-ink/70 mt-3 max-w-md">{group.description}</p>
          )}
        </div>
        {heroImageUrl && (
          <img
            src={heroImageUrl}
            alt={group.label}
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
        )}
      </motion.div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex justify-end mb-6">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-mist rounded-sm px-3 py-2 text-sm bg-bone text-ink"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
        </div>

        {visibleProducts.length === 0 ? (
          <p className="text-ink/60 text-sm">No products yet for this step.</p>
        ) : (
          <>
            <motion.div
              key={sort}
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
