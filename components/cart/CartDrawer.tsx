"use client";

import Image from "next/image";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart/CartContext";
import { formatINR } from "@/lib/utils";
import { LinkButton } from "@/components/ui/button";
import { useState } from "react";

export function CartDrawer() {
  const { items, subtotal, isDrawerOpen, closeDrawer, updateItem, removeItem } = useCart();
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!isDrawerOpen) return null;

  async function handleQuantity(itemId: string, next: number) {
    if (next < 1) return;
    setPendingId(itemId);
    await updateItem(itemId, next);
    setPendingId(null);
  }

  async function handleRemove(itemId: string) {
    setPendingId(itemId);
    await removeItem(itemId);
    setPendingId(null);
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <button
        aria-label="Close bag"
        className="absolute inset-0 bg-charcoal/40"
        onClick={closeDrawer}
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-ivory shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 hairline border-b">
          <h2 className="font-display text-2xl">Your Bag</h2>
          <button onClick={closeDrawer} aria-label="Close bag" className="p-1">
            <X size={20} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <p className="font-display text-2xl mb-2">Your bag is waiting.</p>
            <p className="text-charcoal/60 text-sm mb-6">
              Explore the collection and add a piece you love.
            </p>
            <LinkButton href="/shop" onClick={closeDrawer} variant="outline">
              Explore the Collection
            </LinkButton>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4">
                  <div className="relative h-28 w-20 shrink-0 bg-parchment overflow-hidden">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.product.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg leading-tight truncate">{item.product.name}</p>
                    <p className="text-xs text-charcoal/60 mt-1">
                      {item.variant.color} · {item.variant.size} · SKU {item.variant.sku}
                    </p>
                    <p className="text-sm mt-1">{formatINR(item.variant.price)}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-charcoal/25">
                        <button
                          aria-label={`Decrease quantity of ${item.product.name}`}
                          disabled={pendingId === item.id}
                          onClick={() => handleQuantity(item.id, item.quantity - 1)}
                          className="p-1.5 disabled:opacity-40"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="px-3 text-sm" aria-live="polite">
                          {item.quantity}
                        </span>
                        <button
                          aria-label={`Increase quantity of ${item.product.name}`}
                          disabled={pendingId === item.id || item.quantity >= item.variant.stock_quantity}
                          onClick={() => handleQuantity(item.id, item.quantity + 1)}
                          className="p-1.5 disabled:opacity-40"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        aria-label={`Remove ${item.product.name} from bag`}
                        disabled={pendingId === item.id}
                        onClick={() => handleRemove(item.id)}
                        className="text-charcoal/50 hover:text-burgundy"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="px-6 py-5 hairline border-t space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-charcoal/60">Subtotal</span>
                <span className="font-medium">{formatINR(subtotal)}</span>
              </div>
              <p className="text-xs text-charcoal/50">Shipping and discounts calculated at checkout.</p>
              <LinkButton href="/checkout" onClick={closeDrawer} className="w-full">
                Checkout
              </LinkButton>
              <LinkButton href="/cart" onClick={closeDrawer} variant="outline" className="w-full">
                View Bag
              </LinkButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
