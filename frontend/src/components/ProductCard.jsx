import { Link } from "react-router-dom";
import { cloudinaryUrl } from "../api/client";

export default function ProductCard({ product }) {
  const imageUrl = cloudinaryUrl(product.cloudinary_public_id, { width: 400 });
  const price = (product.price_cents / 100).toFixed(0);

  return (
    <Link
      to={`/shop/${product.slug}`}
      className="group flex flex-col rounded-sm border border-mist bg-bone-light overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
    >
      <div className="aspect-square bg-mist overflow-hidden">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
      </div>
      <div className="p-3 flex flex-col gap-1">
        {product.key_actives && (
          <span className="font-mono text-[10px] tracking-wide text-sage-dark uppercase">
            {product.key_actives}
          </span>
        )}
        <h3 className="text-sm font-semibold text-ink leading-snug">{product.name}</h3>
        <span className="text-sm text-ink/80">KES {price}</span>
      </div>
    </Link>
  );
}
