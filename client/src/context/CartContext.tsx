import { createContext, useContext, type ReactNode } from "react";
import { useCart, type UseCartReturn } from "../hooks/useCart";

const CartContext = createContext<UseCartReturn | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const cart = useCart();
  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
}

export function useCartContext(): UseCartReturn {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCartContext must be used within a CartProvider");
  return ctx;
}
