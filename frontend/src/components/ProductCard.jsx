import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
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
  const location = useLocation();
  const goToLogin = () => navigate("/login", { state: { from: location.pathname } });
  const imageUrl = cloudinaryUrl(product.cloudinary_public_id, { width: 400 });
  const price = product.price_from_cents != null ? (product.price_from_cents / 100).toFixed(0) : null;
  const [status, setStatus] = useState("idle"); // idle | adding | added | error
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const wishlisted = isWishlisted(product.id);

  const handleAdd = async () => {
    if (status !== "idle") return;
    if (!user) {
      goToLogin();
      return;
    }
    setStatus("adding");
    try {
      await addItem({ variantId: product.default_variant_id });
      setStatus("added");
    } catch {
      setStatus("error"); // used to fail silently
    }
    setTimeout(() => setStatus("idle"), 2200);
  };

  const toggleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (wishlistBusy) return;
    if (!user) {
      goToLogin();
      return;
    }
    setWishlistBusy(true);
    try {
      if (wishlisted) await removeFromWishlist(product.id);
      else await addToWishlist(product.id);
    } catch {
      // state is unchanged on failure; the heart simply stays as it was
    } finally {
      setWishlistBusy(false);
    }
  };

  const addLabel = () => {
    if (!product.in_stock || !product.default_variant_id) return "Out of stock";
    if (!user) return "Sign in to add to cart";
    if (status === "added") return "Added to cart";
    if (status === "error") return "Couldn't add -- try again";
    if (status === "adding") return "Adding…";
    return "Add to cart";
  };

  return (
    <div className="relative flex flex-col rounded-sm border border-mist bg-bone-light overflow-hidden">
      {/* Sibling of the Link, not inside it -- a button nested in an <a> is
          invalid HTML and confuses keyboard/screen-reader users. */}
      <motion.button
        type="button"
        onClick={toggleWishlist}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
        className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-bone-light/90 flex items-center justify-center text-orange-700 shadow-sm"
      >
        {wishlisted ? <HeartFilledIcon className="w-4 h-4" /> : <HeartIcon className="w-4 h-4" />}
      </motion.button>
      <Link
        to={`/shop/${product.slug}`}
        className="group flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange"
      >
        <div className="relative aspect-square bg-mist overflow-hidden">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
          {!product.in_stock && (
            <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wide bg-bone-light/90 text-ink/60 px-2 py-1 rounded-sm">
              Out of stock
            </span>
          )}
        </div>
        <div className="p-3 flex flex-col gap-1">
          {product.key_actives && (
            <span className="font-mono text-[10px] tracking-wide text-lime-800 uppercase">
              {product.key_actives}
            </span>
          )}
          <h3 className="text-sm font-semibold text-ink leading-snug">{product.name}</h3>
          <span className="text-sm text-ink/80">{price ? `From KES ${price}` : "Currently unavailable"}</span>
        </div>
      </Link>

      <button
        type="button"
        onClick={handleAdd}
        disabled={!product.in_stock || !product.default_variant_id || status === "adding"}
        className={`w-full py-2.5 text-xs font-semibold border-t transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 ${
          status === "added"
            ? "bg-lime text-ink border-lime"
            : status === "error"
            ? "bg-orange-700 text-ink border-orange-700"
            : "bg-orange text-ink border-orange hover:bg-orange-400"
        }`}
      >
        {status === "added" && <CheckIcon className="w-3.5 h-3.5" />}
        {status === "idle" && product.in_stock && <BagIcon className="w-3.5 h-3.5" />}
        {addLabel()}
      </button>
    </div>
  );
}
