import { motion } from "framer-motion";
import { useWishlist } from "../../context/WishlistContext";
import ProductCard from "../../components/ProductCard.jsx";
import { containerReveal, itemReveal } from "../../components/Reveal.jsx";

export default function AccountWishlist() {
  const { wishlist } = useWishlist();
  const products = wishlist.items.map((item) => item.product).filter(Boolean);

  if (products.length === 0) {
    return (
      <div className="border border-mist rounded-sm bg-bone-light p-6 text-center">
        <p className="text-sm text-ink/60">Nothing saved yet -- tap the heart on any product to add it here.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerReveal}
      className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"
    >
      {products.map((product) => (
        <motion.div key={product.id} variants={itemReveal}>
          <ProductCard product={product} />
        </motion.div>
      ))}
    </motion.div>
  );
}
