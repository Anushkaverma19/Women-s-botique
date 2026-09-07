"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

const COLORS = [
  "Ivory",
  "Magenta",
  "Silver Grey",
  "Gold",
  "Violet",
  "Multicolour",
  "Emerald",
  "Midnight Blue",
  "Coral",
  "Red",
  "Burgundy",
  "Black",
];
const SIZES = ["XS", "S", "M", "L", "XL", "One Size"];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

export function FiltersBar({ categories }: { categories: { name: string; slug: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const activeCategory = searchParams.get("category") ?? "";
  const activeColor = searchParams.get("color") ?? "";
  const activeSize = searchParams.get("size") ?? "";
  const activeSort = searchParams.get("sort") ?? "featured";
  const inStock = searchParams.get("inStock") === "true";
  const hasFilters = activeCategory || activeColor || activeSize || inStock;

  const content = (
    <div className="space-y-8">
      <FilterGroup label="Category">
        <FilterPill active={!activeCategory} onClick={() => setParam("category", null)}>
          All
        </FilterPill>
        {categories.map((c) => (
          <FilterPill key={c.slug} active={activeCategory === c.slug} onClick={() => setParam("category", c.slug)}>
            {c.name}
          </FilterPill>
        ))}
      </FilterGroup>

      <FilterGroup label="Colour">
        <FilterPill active={!activeColor} onClick={() => setParam("color", null)}>
          All
        </FilterPill>
        {COLORS.map((c) => (
          <FilterPill key={c} active={activeColor === c} onClick={() => setParam("color", c)}>
            {c}
          </FilterPill>
        ))}
      </FilterGroup>

      <FilterGroup label="Size">
        <FilterPill active={!activeSize} onClick={() => setParam("size", null)}>
          All
        </FilterPill>
        {SIZES.map((s) => (
          <FilterPill key={s} active={activeSize === s} onClick={() => setParam("size", s)}>
            {s}
          </FilterPill>
        ))}
      </FilterGroup>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => setParam("inStock", e.target.checked ? "true" : null)}
          className="h-4 w-4 accent-charcoal"
        />
        In stock only
      </label>

      {hasFilters ? (
        <button
          onClick={() => router.push(pathname)}
          className="eyebrow text-burgundy underline underline-offset-4"
        >
          Clear all filters
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden flex items-center gap-2 eyebrow border border-charcoal/25 px-4 py-2"
        >
          <SlidersHorizontal size={14} /> Filters
        </button>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="sort" className="eyebrow text-charcoal/60 hidden sm:inline">
            Sort
          </label>
          <select
            id="sort"
            value={activeSort}
            onChange={(e) => setParam("sort", e.target.value)}
            className="border border-charcoal/25 bg-ivory px-3 py-2 text-sm outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="hidden lg:block">{content}</div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button aria-label="Close filters" className="absolute inset-0 bg-charcoal/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-80 bg-ivory p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <p className="eyebrow">Filters</p>
              <button onClick={() => setMobileOpen(false)} aria-label="Close filters">
                <X size={18} />
              </button>
            </div>
            {content}
          </div>
        </div>
      ) : null}
    </>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="eyebrow text-charcoal/50 mb-3">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`text-xs px-3 py-1.5 border ${
        active ? "bg-charcoal text-ivory border-charcoal" : "border-charcoal/25 hover:border-charcoal"
      }`}
    >
      {children}
    </button>
  );
}
