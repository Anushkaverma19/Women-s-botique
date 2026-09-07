"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductVariant } from "@/types/database";

export function VariantManager({ productId, variants }: { productId: string; variants: ProductVariant[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function addVariant(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/admin/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          color,
          size,
          sku,
          price: Number(price),
          stockQuantity: Number(stock),
          active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add variant.");
        return;
      }
      setColor("");
      setSize("");
      setSku("");
      setPrice("");
      setStock("0");
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  async function updateVariant(id: string, patch: Partial<{ stockQuantity: number; price: number; active: boolean }>) {
    setSavingId(id);
    try {
      await fetch(`/api/admin/variants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  const inputClass = "border border-black/15 bg-white rounded px-2.5 py-1.5 text-sm outline-none focus:border-black/40";

  return (
    <div className="bg-white border border-black/10 rounded p-6 max-w-3xl">
      <h2 className="text-sm font-medium mb-4">Variants &amp; Inventory</h2>
      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="text-left text-black/40 text-xs uppercase tracking-wide">
            <th className="py-2 font-medium">Color</th>
            <th className="py-2 font-medium">Size</th>
            <th className="py-2 font-medium">SKU</th>
            <th className="py-2 font-medium">Price</th>
            <th className="py-2 font-medium">Stock</th>
            <th className="py-2 font-medium">Active</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((variant) => (
            <tr key={variant.id} className="border-t border-black/5">
              <td className="py-2">{variant.color}</td>
              <td className="py-2">{variant.size}</td>
              <td className="py-2 text-black/50">{variant.sku}</td>
              <td className="py-2">
                <input
                  type="number"
                  min={0}
                  defaultValue={variant.price}
                  className={`${inputClass} w-24`}
                  onBlur={(e) => {
                    const val = Number(e.target.value);
                    if (val !== variant.price) updateVariant(variant.id, { price: val });
                  }}
                />
              </td>
              <td className="py-2">
                <input
                  type="number"
                  min={0}
                  defaultValue={variant.stock_quantity}
                  className={`${inputClass} w-20 ${variant.stock_quantity <= 3 ? "border-burgundy" : ""}`}
                  onBlur={(e) => {
                    const val = Number(e.target.value);
                    if (val !== variant.stock_quantity) updateVariant(variant.id, { stockQuantity: val });
                  }}
                />
              </td>
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={variant.active}
                  disabled={savingId === variant.id}
                  onChange={(e) => updateVariant(variant.id, { active: e.target.checked })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={addVariant} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs text-black/50 mb-1">Color</label>
          <input required className={inputClass} value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-black/50 mb-1">Size</label>
          <input required className={inputClass} value={size} onChange={(e) => setSize(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-black/50 mb-1">SKU</label>
          <input required className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-black/50 mb-1">Price</label>
          <input required type="number" min={0} className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-black/50 mb-1">Stock</label>
          <input required type="number" min={0} className={inputClass} value={stock} onChange={(e) => setStock(e.target.value)} />
        </div>
        <div className="col-span-2 sm:col-span-5">
          {error ? <p className="text-xs text-burgundy mb-2">{error}</p> : null}
          <button type="submit" disabled={adding} className="text-xs bg-[#1a1a1a] text-white px-4 py-2 rounded disabled:opacity-50">
            {adding ? "Adding..." : "+ Add Variant"}
          </button>
        </div>
      </form>
    </div>
  );
}
