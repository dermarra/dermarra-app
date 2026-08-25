import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cloudinaryUrl } from "../api/client";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import { BagIcon, CheckIcon, HeartIcon, HeartFilledIcon } from "./Icons.jsx";

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const { isWishlisted, addToWishlist, removeFromWishlist } = useWishlist();
  const navigate = useNavigate();
  const imageUrl = cloudinaryUrl(product.cloudinary_public_id, { width: 400 });
  const price = (product.price_cents / 100).toFixed(0);
  const [status, setStatus] = useState("idle"); // idle | adding | added
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const wishlisted = isWishlisted(product.id);

  const handleAdd = async () => {
    if (status !== "idle") return;
    if (!user) {
      navigate("/login");
      return;
    }
    setStatus("adding");
    try {
      await addItem({ productId: product.id });
      setStatus("added");
      setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("idle");
    }
  };

  const toggleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (wishlistBusy) return;
    if (!user) {
      navigate("/login");
      return;
    }
    setWishlistBusy(true);
    try {
      if (wishlisted) await removeFromWishlist(product.id);
      else await addToWishlist(product.id);
    } finally {
      setWishlistBusy(false);
    }
  };

  const addLabel = () => {
    if (!product.in_stock) return "Out of stock";
    if (!user) return "Sign in to add to cart";
    if (status === "added") return "Added to cart";
    if (status === "adding") return "Adding…";
    return "Add to cart";
  };

  return (
    <div className="flex flex-col rounded-sm border border-mist bg-bone-light overflow-hidden">
      <Link
        to={`/shop/${product.slug}`}
        className="group flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
      >
        <div className="relative aspect-square bg-mist overflow-hidden">
          <motion.button
            type="button"
            onClick={toggleWishlist}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
            className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-bone-light/90 flex items-center justify-center text-clay shadow-sm"
          >
            {wishlisted ? <HeartFilledIcon className="w-4 h-4" /> : <HeartIcon className="w-4 h-4" />}
          </motion.button>
          {imageUrl && (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
          {product.stock_status === "out_of_stock" && (
            <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wide bg-bone-light/90 text-ink/60 px-2 py-1 rounded-sm">
              Out of stock
            </span>
          )}
          {product.stock_status === "low_stock" && (
            <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wide bg-bone-light/90 text-amber-dark px-2 py-1 rounded-sm">
              Low stock
            </span>
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

      <button
        type="button"
        onClick={handleAdd}
        disabled={!product.in_stock || status === "adding"}
        className={`w-full py-2.5 text-xs font-semibold border-t transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 ${
          status === "added"
            ? "bg-sage text-bone-light border-sage"
            : "bg-amber text-bone-light border-amber hover:bg-amber-dark"
        }`}
      >
        {status === "added" && <CheckIcon className="w-3.5 h-3.5" />}
        {status === "idle" && product.in_stock && <BagIcon className="w-3.5 h-3.5" />}
        {addLabel()}
      </button>
    </div>
  );
}
