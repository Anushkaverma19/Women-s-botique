"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartContext";
import { Button } from "@/components/ui/button";
import type { ProductVariant } from "@/types/database";

export function AddToBagForm({ variants }: { variants: ProductVariant[] }) {
  const colors = useMemo(() => Array.from(new Set(variants.map((v) => v.color))), [variants]);
  const sizes = useMemo(() => Array.from(new Set(variants.map((v) => v.size))), [variants]);

  const [color, setColor] = useState(colors[0]);
  const [size, setSize] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "added">("idle");
  const [error, setError] = useState<string | null>(null);
  const { addItem } = useCart();
  const router = useRouter();

  const selectedVariant = variants.find((v) => v.color === color && v.size === size) ?? null;
  const isSoldOut = (s: string) => {
    const v = variants.find((vv) => vv.color === color && vv.size === s);
    return !v || !v.active || v.stock_quantity <= 0;
  };

  async function handleAdd() {
    if (!selectedVariant) {
      setError("Select a size to continue.");
      return;
    }
    setStatus("loading");
    setError(null);
    const result = await addItem(selectedVariant.id, 1);
    if (!result.ok) {
      if (result.error?.toLowerCase().includes("auth")) {
        router.push("/login?redirectTo=" + encodeURIComponent(window.location.pathname));
        return;
      }
      setStatus("error");
      setError(result.error ?? "Could not add this item.");
      return;
    }
    setStatus("added");
  }

  return (
    <div className="space-y-6">
      {colors.length > 1 ? (
        <fieldset>
          <legend className="eyebrow text-charcoal/60 mb-2">Colour: {color}</legend>
          <div className="flex gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setSize(null);
                }}
                aria-pressed={color === c}
                className={`text-xs px-3 py-2 border ${
                  color === c ? "border-charcoal bg-charcoal text-ivory" : "border-charcoal/25"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="eyebrow text-charcoal/60 mb-2">Size</legend>
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => {
            const soldOut = isSoldOut(s);
            return (
              <button
                key={s}
                disabled={soldOut}
                onClick={() => setSize(s)}
                aria-pressed={size === s}
                aria-disabled={soldOut}
                title={soldOut ? `${color} / ${s} is unavailable` : undefined}
                className={`text-xs px-4 py-2.5 border relative ${
                  size === s ? "border-charcoal bg-charcoal text-ivory" : "border-charcoal/25"
                } ${soldOut ? "opacity-30 cursor-not-allowed line-through" : "hover:border-charcoal"}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </fieldset>

      {selectedVariant ? (
        <p className="text-xs text-charcoal/50">
          SKU {selectedVariant.sku} ·{" "}
          {selectedVariant.stock_quantity > 0 && selectedVariant.stock_quantity <= 3
            ? `Only ${selectedVariant.stock_quantity} left`
            : selectedVariant.stock_quantity > 0
              ? "In stock"
              : "Out of stock"}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-burgundy">
          {error}
        </p>
      ) : null}

      <Button
        onClick={handleAdd}
        disabled={status === "loading" || !selectedVariant}
        className="w-full sm:w-auto"
      >
        {status === "loading" ? "Adding..." : status === "added" ? "Added to Bag" : "Add to Bag"}
      </Button>
    </div>
  );
}
