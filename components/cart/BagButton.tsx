"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/CartContext";

export function BagButton() {
  const { itemCount, openDrawer } = useCart();
  return (
    <button aria-label={`Shopping bag, ${itemCount} items`} onClick={openDrawer} className="relative p-1.5">
      <ShoppingBag size={19} />
      {itemCount > 0 ? (
        <span className="absolute -top-1 -right-1 bg-burgundy text-ivory rounded-full text-[10px] leading-none h-4 w-4 flex items-center justify-center">
          {itemCount > 9 ? "9+" : itemCount}
        </span>
      ) : null}
    </button>
  );
}
