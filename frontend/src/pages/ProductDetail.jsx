import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import client from "../api/client";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import { BagIcon, CheckIcon, HeartIcon, MinusIcon, PlusIcon } from "../components/Icons.jsx";
import ProductCard from "../components/ProductCard.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import ThumbnailSlider from "../components/ThumbnailSlider.jsx";
import { containerReveal, itemReveal } from "../components/Reveal.jsx";

/** Product page, laid out like The Ordinary's: image gallery (ThumbnailSlider)
 * on the left; step, name, price, size, quantity + add to cart on the right,
 * then detail rows (targets, format, key ingredients, about). */

const FORMAT = {
  cleanser: "Cleanser",
  serum: "Serum",
  barrier_cream: "Barrier cream",
  spf: "Sunscreen (SPF)",
};
const MAX_QTY = 10;
const kes = (cents) => `KES ${Math.round(cents / 100).toLocaleString("en-KE")}`;

function InfoRow({ label, children }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 py-4 border-t border-mist">
      <dt className="font-semibold">{label}</dt>
      <dd className="text-ink/80">{children}</dd>
    </div>
  );
}

function Disclosure({ title, defaultOpen = false, children }) {
  return (
    <details open={defaultOpen} className="group border-t border-mist">
      <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden font-semibold">
        {title}
        <span className="w-7 h-7 rounded-full bg-ink text-white flex items-center justify-center shrink-0" aria-hidden="true">
          <PlusIcon className="w-3 h-3 group-open:hidden" />
          <MinusIcon className="w-3 h-3 hidden group-open:block" />
        </span>
      </summary>
      <div className="pb-5 text-ink/80 leading-relaxed">{children}</div>
    </details>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [stepGroups, setStepGroups] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [wishBusy, setWishBusy] = useState(false);
  const { addItem } = useCart();
  const { user } = useAuth();
  const { isWishlisted, addToWishlist, removeFromWishlist } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    client
      .get("/products/step-groups")
      .then(({ data }) => setStepGroups(data))
      .catch(() => setStepGroups([]));
  }, []);

  useEffect(() => {
    setProduct(null);
    setLoadError(null);
    setQuantity(1);
    setAddError(null);
    client
      .get(`/products/${slug}`)
      .then(({ data }) => {
        setProduct(data);
        setSelectedVariantId(data.default_variant_id || data.variants?.[0]?.id || null);
        client
          .get("/products", { params: { step_type: data.step_type } })
          .then(({ data: relatedData }) => setRelated(relatedData.filter((p) => p.id !== data.id).slice(0, 4)))
          .catch(() => setRelated([]));
      })
      .catch((err) =>
        setLoadError(err.response?.status === 404 ? "We couldn't find that product." : "Couldn't load this product.")
      );
  }, [slug]);

  // Cover image first, then the gallery in admin order, without duplicates.
  const galleryIds = useMemo(() => {
    if (!product) return [];
    const ids = [...(product.images || [])]
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.position - b.position)
      .map((img) => img.cloudinary_public_id);
    if (product.cloudinary_public_id && !ids.includes(product.cloudinary_public_id)) {
      ids.unshift(product.cloudinary_public_id);
    }
    return ids;
  }, [product]);

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-14 sm:pt-20 pb-12 text-center">
        <p className="text-ink/70">{loadError}</p>
        <Link to="/shop" className="btn btn-primary mt-4">
          Shop all products
        </Link>
      </div>
    );
  }

  if (!product) return <p className="px-5 py-16 text-ink/70 mx-auto max-w-[1200px]">Loading…</p>;

  const variants = (product.variants || []).filter((v) => v.is_active);
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || variants[0];
  const variantInStock = selectedVariant?.in_stock ?? product.in_stock;
  const stepGroup = stepGroups.find((g) => g.step_type === product.step_type);
  const wishlisted = isWishlisted(product.id);

  const goToLogin = () => navigate("/login", { state: { from: location.pathname } });

  const handleAdd = async () => {
    if (!user) return goToLogin();
    if (!selectedVariant) return;
    setAddError(null);
    setAdding(true);
    try {
      await addItem({ variantId: selectedVariant.id, quantity });
      setAdded(true);
      setTimeout(() => setAdded(false), 2200);
    } catch (err) {
      setAddError(err.response?.data?.error || "Couldn't add this to your cart -- please try again.");
    } finally {
      setAdding(false);
    }
  };

  const toggleWishlist = async () => {
    if (!user) return goToLogin();
    if (wishBusy) return;
    setWishBusy(true);
    try {
      if (wishlisted) await removeFromWishlist(product.id);
      else await addToWishlist(product.id);
    } catch {
      // unchanged on failure
    } finally {
      setWishBusy(false);
    }
  };

  const buttonLabel = () => {
    if (!selectedVariant || !variantInStock) return "Out of stock";
    if (!user) return "Sign in to add to cart";
    if (added) return "Added to cart";
    if (adding) return "Adding…";
    return "Add to cart";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12 pt-8 sm:pt-10 pb-28 sm:pb-16"
    >
      <div className="pb-4 mb-8 border-b border-mist">
        <Breadcrumbs
          items={[
            { label: "Shop", to: "/shop" },
            ...(stepGroup ? [{ label: stepGroup.label, to: `/shop/step/${stepGroup.key}` }] : []),
            { label: product.name },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-10 lg:gap-16 items-start">
        <ThumbnailSlider images={galleryIds} alt={product.name} />

        <div className="lg:sticky lg:top-28">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/70">
              {stepGroup ? (
                <Link to={`/shop/step/${stepGroup.key}`} className="hover:text-ink">
                  {stepGroup.label}
                </Link>
              ) : (
                FORMAT[product.step_type] || product.step_type
              )}
            </p>
            <button
              type="button"
              onClick={toggleWishlist}
              aria-pressed={wishlisted}
              aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
              className={`-mt-2 w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                wishlisted ? "bg-orange text-ink" : "text-ink hover:bg-bone-light"
              }`}
            >
              <HeartIcon className="w-4 h-4" />
            </button>
          </div>

          <h1 className="mt-2 text-4xl leading-tight">{product.name}</h1>
          {product.key_actives && (
            <p className="mt-2 font-mono text-xs uppercase tracking-wide text-lime-800">{product.key_actives}</p>
          )}

          {selectedVariant && <p className="mt-6 text-2xl font-semibold">{kes(selectedVariant.price_cents)}</p>}
          {selectedVariant?.stock_status === "low_stock" && (
            <p className="mt-1 text-sm font-semibold text-orange-700">Only a few left in stock</p>
          )}
          {product.short_description && <p className="mt-4 text-lg text-ink/80">{product.short_description}</p>}

          {variants.length > 0 && (
            <div className="mt-8">
              <p className="text-sm">
                Product size: <span className="font-semibold">{selectedVariant?.label}</span>
              </p>
              <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Product size">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariantId(v.id)}
                    aria-pressed={v.id === selectedVariant?.id}
                    className={`chip ${
                      v.id === selectedVariant?.id
                        ? "chip-on"
                        : "chip-off"
                    } ${v.in_stock ? "" : "line-through decoration-1 text-ink/50"}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="hidden sm:flex gap-3 mt-8">
            <div className="flex items-center border border-ink/20 rounded-lg h-[52px] overflow-hidden" role="group" aria-label="Quantity">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
                className="w-11 h-full flex items-center justify-center disabled:opacity-30"
              >
                <MinusIcon className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center tabular-nums" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(MAX_QTY, q + 1))}
                disabled={quantity >= MAX_QTY}
                aria-label="Increase quantity"
                className="w-11 h-full flex items-center justify-center disabled:opacity-30"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleAdd}
              disabled={adding || !selectedVariant || !variantInStock}
              className={`btn flex-1 ${added ? "bg-lime text-ink" : "btn-primary"}`}
            >
              {added ? <CheckIcon className="w-4 h-4" /> : variantInStock && <BagIcon className="w-4 h-4" />}
              {buttonLabel()}
            </motion.button>
          </div>
          {addError && <p className="text-sm text-orange-700 mt-3">{addError}</p>}

          <dl className="mt-10">
            {product.skin_concerns?.length > 0 && (
              <InfoRow label="Targets">
                {product.skin_concerns.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ", "}
                    <Link to={`/shop/concern/${c.slug}`} className="underline underline-offset-4 decoration-ink/30 hover:decoration-ink">
                      {c.name.trim()}
                    </Link>
                  </span>
                ))}
              </InfoRow>
            )}
            <InfoRow label="Format">{FORMAT[product.step_type] || product.step_type}</InfoRow>
            {variants.length > 1 && <InfoRow label="Sizes">{variants.map((v) => v.label).join(", ")}</InfoRow>}
          </dl>

          {(product.ingredients?.length > 0 || product.key_actives) && (
            <Disclosure title="Key ingredients">
              {product.ingredients?.length > 0 ? (
                <ul className="flex flex-col gap-4">
                  {product.ingredients.map((ing) => (
                    <li key={ing.id}>
                      <Link to={`/shop/ingredient/${ing.slug}`} className="font-semibold text-ink hover:underline underline-offset-4">
                        {ing.name}
                      </Link>
                      {ing.description && <p className="mt-1">{ing.description}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{product.key_actives}</p>
              )}
            </Disclosure>
          )}
          {product.description && (
            <Disclosure title="About this product" defaultOpen>
              <p className="whitespace-pre-line">{product.description}</p>
            </Disclosure>
          )}
          {stepGroup?.description && (
            <Disclosure title={`Where it fits: ${stepGroup.label.replace(/^Step\s*0?/i, "Step ")}`}>
              <p>{stepGroup.description}</p>
              <Link to="/quiz" className="inline-block mt-3 font-semibold underline underline-offset-4">
                Build your full routine
              </Link>
            </Disclosure>
          )}
          <div className="border-t border-mist" />
        </div>
      </div>

      {related.length > 0 && (
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerReveal}
          className="mt-20 pt-12 border-t border-mist"
        >
          <motion.h2 variants={itemReveal} className="text-4xl text-ink mb-8">
            You may also like
          </motion.h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {related.map((p) => (
              <motion.div key={p.id} variants={itemReveal}>
                <ProductCard product={p} />
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Phones: add-to-cart pinned above the bottom nav. */}
      <div className="sm:hidden fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] inset-x-0 z-20 bg-white border-t border-mist p-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={handleAdd}
          disabled={adding || !selectedVariant || !variantInStock}
          className={`w-full py-3.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 ${
            added ? "bg-lime text-ink" : "bg-orange text-ink"
          }`}
        >
          {added && <CheckIcon className="w-4 h-4" />}
          {buttonLabel()}
          {selectedVariant && variantInStock && user && !added && ` · ${kes(selectedVariant.price_cents)}`}
        </motion.button>
      </div>
    </motion.div>
  );
}
