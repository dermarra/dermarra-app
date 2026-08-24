import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import client, { cloudinaryUrl } from "../api/client";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { BagIcon, CheckIcon } from "../components/Icons.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { containerReveal, itemReveal } from "../components/Reveal.jsx";

const STEP_LABELS = {
  cleanser: "Cleanser",
  serum: "Serum",
  barrier_cream: "Barrier cream",
  spf: "SPF",
};

export default function ProductDetail() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState(null);
  const { addItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setSelectedIndex(0);
    client.get(`/products/${slug}`).then(({ data }) => {
      setProduct(data);
      client
        .get("/products", { params: { step_type: data.step_type } })
        .then(({ data: relatedData }) => setRelated(relatedData.filter((p) => p.id !== data.id).slice(0, 4)));
    });
  }, [slug]);

  if (!product) return <p className="p-4 text-sm text-ink/60">Loading…</p>;

  const price = (product.price_cents / 100).toFixed(0);
  const galleryIds =
    product.images?.length > 0
      ? product.images.map((img) => img.cloudinary_public_id)
      : product.cloudinary_public_id
      ? [product.cloudinary_public_id]
      : [];
  const mainImageUrl = cloudinaryUrl(galleryIds[selectedIndex], { width: 600 });

  const handleAdd = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setAddError(null);
    setAdding(true);
    try {
      await addItem({ productId: product.id });
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      setAddError(err.response?.data?.error || "Couldn't add this to your cart -- please try again.");
    } finally {
      setAdding(false);
    }
  };

  const buttonLabel = (withPrice) => {
    if (!product.in_stock) return "Out of stock";
    if (!user) return "Sign in to add to cart";
    if (added) return "Added to cart";
    if (adding) return "Adding…";
    return withPrice ? `Add to cart · KES ${price}` : "Add to cart";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mx-auto max-w-4xl px-4 py-6 pb-28 sm:pb-6"
    >
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <motion.div
            key={selectedIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="aspect-square bg-mist rounded-sm overflow-hidden"
          >
            {mainImageUrl && (
              <img src={mainImageUrl} alt={product.name} className="w-full h-full object-cover" />
            )}
          </motion.div>

          {galleryIds.length > 1 && (
            <div className="flex gap-2 mt-3">
              {galleryIds.map((id, index) => (
                <button
                  key={id}
                  onClick={() => setSelectedIndex(index)}
                  className={`w-14 h-14 rounded-sm overflow-hidden border shrink-0 transition-colors ${
                    index === selectedIndex ? "border-amber" : "border-mist"
                  }`}
                >
                  <img
                    src={cloudinaryUrl(id, { width: 100 })}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {product.key_actives && (
            <span className="font-mono text-xs tracking-wide text-sage-dark uppercase">
              {product.key_actives}
            </span>
          )}
          <h1 className="font-display text-2xl mt-1 text-ink">{product.name}</h1>
          <p className="text-ink/70 mt-2">{product.short_description}</p>
          <p className="text-xl font-semibold mt-4 text-ink">KES {price}</p>
          {product.stock_status === "low_stock" && (
            <p className="text-xs font-semibold text-amber-dark mt-2">Only a few left in stock</p>
          )}

          {product.skin_concerns?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {product.skin_concerns.map((c) => (
                <span
                  key={c.id}
                  className="text-[11px] px-2 py-1 rounded-full bg-clay/10 text-clay font-medium"
                >
                  {c.name}
                </span>
              ))}
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAdd}
            disabled={adding || !product.in_stock}
            className={`hidden sm:flex mt-6 w-full py-3 rounded-sm font-semibold transition-colors disabled:opacity-50 items-center justify-center gap-2 ${
              added ? "bg-sage text-bone-light" : "bg-amber text-bone-light hover:bg-amber-dark"
            }`}
          >
            {added && <CheckIcon className="w-4 h-4" />}
            {!added && product.in_stock && <BagIcon className="w-4 h-4" />}
            {buttonLabel(false)}
          </motion.button>
          {addError && <p className="text-sm text-clay mt-2">{addError}</p>}

          <dl className="mt-6 flex flex-col gap-2 text-sm border-t border-mist pt-4">
            <div className="flex justify-between">
              <dt className="text-ink/60">Format</dt>
              <dd className="text-ink font-medium">{STEP_LABELS[product.step_type] || product.step_type}</dd>
            </div>
            {product.key_actives && (
              <div className="flex justify-between gap-6">
                <dt className="text-ink/60 shrink-0">Key ingredients</dt>
                <dd className="text-ink font-medium text-right">{product.key_actives}</dd>
              </div>
            )}
          </dl>

          {product.description && (
            <div className="mt-6 text-sm text-ink/70 leading-relaxed whitespace-pre-line">
              {product.description}
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerReveal}
          className="mt-16 pt-10 border-t border-mist"
        >
          <motion.h2 variants={itemReveal} className="font-display text-xl text-ink mb-6">
            You may also like
          </motion.h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {related.map((p) => (
              <motion.div key={p.id} variants={itemReveal}>
                <ProductCard product={p} />
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      <div className="sm:hidden fixed bottom-16 inset-x-0 z-20 bg-bone-light border-t border-mist p-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleAdd}
          disabled={adding || !product.in_stock}
          className={`w-full py-3 rounded-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 ${
            added ? "bg-sage text-bone-light" : "bg-amber text-bone-light"
          }`}
        >
          {added && <CheckIcon className="w-4 h-4" />}
          {buttonLabel(true)}
        </motion.button>
      </div>
    </motion.div>
  );
}
