"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartItemWithDetails } from "@/types/database";

interface CartContextValue {
  items: CartItemWithDetails[];
  subtotal: number;
  itemCount: number;
  loading: boolean;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  refresh: () => Promise<void>;
  addItem: (variantId: string, quantity?: number) => Promise<{ ok: boolean; error?: string }>;
  updateItem: (itemId: string, quantity: number) => Promise<{ ok: boolean; error?: string }>;
  removeItem: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItemWithDetails[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cart");
      if (!res.ok) {
        setItems([]);
        setSubtotal(0);
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setSubtotal(data.subtotal ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Intentional fetch-on-mount to hydrate the cart from the server -
    // the documented exception to "avoid effects", not a synchronization
    // bug (see https://react.dev/learn/you-might-not-need-an-effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (variantId: string, quantity = 1) => {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error as string };
      setItems(data.items ?? []);
      setSubtotal(data.subtotal ?? 0);
      setDrawerOpen(true);
      return { ok: true };
    },
    []
  );

  const updateItem = useCallback(async (itemId: string, quantity: number) => {
    const res = await fetch(`/api/cart/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error as string };
    setItems(data.items ?? []);
    setSubtotal(data.subtotal ?? 0);
    return { ok: true };
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    const res = await fetch(`/api/cart/items/${itemId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error as string };
    setItems(data.items ?? []);
    setSubtotal(data.subtotal ?? 0);
    return { ok: true };
  }, []);

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const value: CartContextValue = {
    items,
    subtotal,
    itemCount,
    loading,
    isDrawerOpen,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
    refresh,
    addItem,
    updateItem,
    removeItem,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
