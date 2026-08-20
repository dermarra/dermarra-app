import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import client, { cloudinaryUrl } from "../api/client";
import { useCart } from "../context/CartContext";

export default function ProductDetail() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [adding, setAdding] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    client.get(`/products/${slug}`).then(({ data }) => setProduct(data));
  }, [slug]);

  if (!product) return <p className="p-4 text-sm text-ink/60">Loading…</p>;

  const price = (product.price_cents / 100).toFixed(0);
  const imageUrl = cloudinaryUrl(product.cloudinary_public_id, { width: 600 });

  const handleAdd = async () => {
    setAdding(true);
    try {
      await addItem({ productId: product.id });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 pb-28 sm:pb-6">
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="aspect-square bg-mist rounded-sm overflow-hidden">
          {imageUrl && <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />}
        </div>

        <div>
          {product.key_actives && (
            <span className="font-mono text-xs tracking-wide text-sage-dark uppercase">
              {product.key_actives}
            </span>
          )}
          <h1 className="font-display text-2xl mt-1">{product.name}</h1>
          <p className="text-ink/70 mt-2">{product.short_description}</p>
          <p className="text-xl font-semibold mt-4">KES {price}</p>

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

          <button
            onClick={handleAdd}
            disabled={adding || !product.in_stock}
            className="hidden sm:block mt-6 w-full py-3 rounded-sm bg-amber text-bone-light font-semibold hover:bg-amber-dark transition-colors disabled:opacity-50"
          >
            {product.in_stock ? (adding ? "Adding…" : "Add to cart") : "Out of stock"}
          </button>

          {product.description && (
            <div className="mt-6 text-sm text-ink/70 leading-relaxed whitespace-pre-line">
              {product.description}
            </div>
          )}
        </div>
      </div>

      <div className="sm:hidden fixed bottom-16 inset-x-0 z-20 bg-bone-light border-t border-mist p-3">
        <button
          onClick={handleAdd}
          disabled={adding || !product.in_stock}
          className="w-full py-3 rounded-sm bg-amber text-bone-light font-semibold disabled:opacity-50"
        >
          {product.in_stock ? (adding ? "Adding…" : `Add to cart · KES ${price}`) : "Out of stock"}
        </button>
      </div>
    </div>
  );
}
