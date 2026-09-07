"use client";

import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/cart/CartContext";
import { Container, EmptyState, Skeleton } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";

export default function CartPage() {
  const { items, subtotal, loading, updateItem, removeItem } = useCart();
  const [pendingId, setPendingId] = useState<string | null>(null);

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

  if (loading && items.length === 0) {
    return (
      <Container className="py-16 max-w-4xl">
        <Skeleton className="h-10 w-48 mb-10" />
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-32 w-full" />
      </Container>
    );
  }

  if (items.length === 0) {
    return (
      <Container className="py-16">
        <EmptyState
          title="Your bag is waiting."
          description="Explore the collection and add a piece you love."
          action={<LinkButton href="/shop">Explore the Collection</LinkButton>}
        />
      </Container>
    );
  }

  return (
    <Container className="py-12 max-w-5xl">
      <h1 className="font-display text-4xl mb-10">Your Bag</h1>
      <div className="grid lg:grid-cols-[1fr_320px] gap-12">
        <ul className="divide-y divide-charcoal/10">
          {items.map((item) => (
            <li key={item.id} className="py-6 flex gap-5">
              <div className="relative h-36 w-28 shrink-0 bg-parchment overflow-hidden">
                {item.image ? (
                  <Image src={item.image} alt={item.product.name} fill sizes="112px" className="object-cover" />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-display text-xl">{item.product.name}</p>
                    <p className="text-xs text-charcoal/60 mt-1">
                      {item.variant.color} · {item.variant.size} · SKU {item.variant.sku}
                    </p>
                  </div>
                  <p className="text-sm shrink-0">{formatINR(item.variant.price * item.quantity)}</p>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex items-center border border-charcoal/25">
                    <button
                      aria-label={`Decrease quantity of ${item.product.name}`}
                      disabled={pendingId === item.id}
                      onClick={() => handleQuantity(item.id, item.quantity - 1)}
                      className="p-2 disabled:opacity-40"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="px-4 text-sm" aria-live="polite">
                      {item.quantity}
                    </span>
                    <button
                      aria-label={`Increase quantity of ${item.product.name}`}
                      disabled={pendingId === item.id || item.quantity >= item.variant.stock_quantity}
                      onClick={() => handleQuantity(item.id, item.quantity + 1)}
                      className="p-2 disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    aria-label={`Remove ${item.product.name} from bag`}
                    disabled={pendingId === item.id}
                    onClick={() => handleRemove(item.id)}
                    className="flex items-center gap-1.5 text-xs text-charcoal/50 hover:text-burgundy"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="border border-charcoal/15 p-6 h-max sticky top-28">
          <p className="eyebrow mb-4">Order Summary</p>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-charcoal/60">Subtotal</span>
            <span>{formatINR(subtotal)}</span>
          </div>
          <p className="text-xs text-charcoal/50 mb-6">Shipping and coupon applied at checkout.</p>
          <LinkButton href="/checkout" className="w-full">
            Proceed to Checkout
          </LinkButton>
        </div>
      </div>
    </Container>
  );
}
