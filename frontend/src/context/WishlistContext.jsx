import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import client from "../api/client";
import { useAuth } from "./AuthContext";

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState({ items: [] });

  const refreshWishlist = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await client.get("/wishlist");
      setWishlist(data);
    } catch {
      // non-critical -- hearts just show as unsaved until the next refresh
    }
  }, [user]);

  useEffect(() => {
    if (user) refreshWishlist();
    else setWishlist({ items: [] });
  }, [user, refreshWishlist]);

  const addToWishlist = useCallback(async (productId) => {
    const { data } = await client.post("/wishlist/items", { product_id: productId });
    setWishlist(data);
  }, []);

  const removeFromWishlist = useCallback(async (productId) => {
    const { data } = await client.delete(`/wishlist/items/by-product/${productId}`);
    setWishlist(data);
  }, []);

  const productIds = useMemo(() => new Set(wishlist.items.map((item) => item.product?.id)), [wishlist]);
  const isWishlisted = useCallback((productId) => productIds.has(productId), [productIds]);

  return (
    <WishlistContext.Provider
      value={{ wishlist, addToWishlist, removeFromWishlist, isWishlisted, refreshWishlist }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
