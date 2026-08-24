import { createContext, useContext, useState, useCallback, useEffect } from "react";
import client from "../api/client";
import { useAuth } from "./AuthContext";

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState({ items: [] });

  const refreshWishlist = useCallback(async () => {
    if (!user) return;
    const { data } = await client.get("/wishlist");
    setWishlist(data);
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

  const productIds = new Set(wishlist.items.map((item) => item.product?.id));
  const isWishlisted = useCallback((productId) => productIds.has(productId), [wishlist]);

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
