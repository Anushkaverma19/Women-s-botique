"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/utils";
import { OCCASIONS } from "@/types/database";
import type { Category, Product } from "@/types/database";

interface ProductFormProps {
  categories: Category[];
  product?: Product;
}

export function ProductForm({ categories, product }: ProductFormProps) {
  const router = useRouter();
  const isEdit = Boolean(product);

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? "");
  const [shortDescription, setShortDescription] = useState(product?.short_description ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [basePrice, setBasePrice] = useState(String(product?.base_price ?? ""));
  const [compareAtPrice, setCompareAtPrice] = useState(
    product?.compare_at_price ? String(product.compare_at_price) : ""
  );
  const [material, setMaterial] = useState(product?.material ?? "");
  const [care, setCare] = useState(product?.care ?? "");
  const [colorFamily, setColorFamily] = useState(product?.color_family ?? "");
  const [occasionTags, setOccasionTags] = useState<string[]>(product?.occasion_tags ?? []);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [active, setActive] = useState(product?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleOccasion(tag: string) {
    setOccasionTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name,
      slug,
      categoryId,
      description,
      shortDescription,
      basePrice: Number(basePrice),
      compareAtPrice: compareAtPrice ? Number(compareAtPrice) : null,
      material,
      care,
      colorFamily,
      occasionTags,
      featured,
      active,
    };

    try {
      const res = await fetch(isEdit ? `/api/admin/products/${product!.id}` : "/api/admin/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save this product.");
        return;
      }
      if (isEdit) {
        router.refresh();
      } else {
        router.push(`/admin/products/${data.product.id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full border border-black/15 bg-white rounded px-3 py-2 text-sm outline-none focus:border-black/40";
  const labelClass = "block text-xs font-medium text-black/60 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-black/10 rounded p-6 space-y-6 max-w-3xl">
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="name">
            Product Name
          </label>
          <input
            id="name"
            className={inputClass}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="slug">
            URL Slug
          </label>
          <input
            id="slug"
            className={inputClass}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="category">
            Category
          </label>
          <select id="category" className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="colorFamily">
            Colour
          </label>
          <input id="colorFamily" className={inputClass} value={colorFamily} onChange={(e) => setColorFamily(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="basePrice">
            Price (₹)
          </label>
          <input id="basePrice" type="number" min={0} className={inputClass} value={basePrice} onChange={(e) => setBasePrice(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="compareAtPrice">
            Compare-at Price (₹, optional)
          </label>
          <input id="compareAtPrice" type="number" min={0} className={inputClass} value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="material">
            Material
          </label>
          <input id="material" className={inputClass} value={material} onChange={(e) => setMaterial(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="care">
            Care Instructions
          </label>
          <input id="care" className={inputClass} value={care} onChange={(e) => setCare(e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="shortDescription">
            Short Description
          </label>
          <input id="shortDescription" className={inputClass} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="description">
            Full Description
          </label>
          <textarea id="description" className={`${inputClass} min-h-32`} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
      </div>

      <div>
        <p className={labelClass}>Occasion Tags</p>
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={() => toggleOccasion(tag)}
              className={`text-xs px-3 py-1.5 rounded border ${
                occasionTags.includes(tag) ? "bg-black text-white border-black" : "border-black/15"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Featured
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
      </div>

      {error ? <p className="text-sm text-burgundy">{error}</p> : null}

      <button type="submit" disabled={saving} className="bg-[#1a1a1a] text-white text-sm px-5 py-2.5 rounded disabled:opacity-50">
        {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Product"}
      </button>
    </form>
  );
}
