import { createContext, useContext, useState, useCallback, useEffect } from "react";
import client from "../api/client";
import { useAuth } from "./AuthContext";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await client.get("/cart");
      setCart(data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) refreshCart();
    else setCart({ items: [] });
  }, [user, refreshCart]);

  const addItem = useCallback(async ({ productId, routineId, quantity = 1 }) => {
    const { data } = await client.post("/cart/items", {
      product_id: productId,
      routine_id: routineId,
      quantity,
    });
    setCart(data);
  }, []);

  const updateItem = useCallback(async (itemId, quantity) => {
    const { data } = await client.patch(`/cart/items/${itemId}`, { quantity });
    setCart(data);
  }, []);

  const removeItem = useCallback(async (itemId) => {
    const { data } = await client.delete(`/cart/items/${itemId}`);
    setCart(data);
  }, []);

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, loading, itemCount, refreshCart, addItem, updateItem, removeItem }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
