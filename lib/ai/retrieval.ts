import { createClient } from "@/lib/supabase/server";
import type { ProductWithRelations } from "@/types/database";
import { OCCASIONS } from "@/types/database";

const COLOR_WORDS = [
  "ivory",
  "burgundy",
  "emerald",
  "gold",
  "magenta",
  "silver",
  "grey",
  "gray",
  "violet",
  "purple",
  "red",
  "black",
  "coral",
  "blue",
  "green",
  "pink",
  "white",
  "navy",
  "maroon",
  "teal",
  "peach",
  "rose",
  "cream",
  "beige",
  "champagne",
  "multicolour",
  "multicolor",
];

const CATEGORY_SYNONYMS: Record<string, string> = {
  saree: "sarees",
  sarees: "sarees",
  sari: "sarees",
  saris: "sarees",
  lehenga: "lehengas",
  lehengas: "lehengas",
  lehnga: "lehengas",
  lengha: "lehengas",
  dress: "dresses",
  dresses: "dresses",
  gown: "dresses",
  gowns: "dresses",
  jewellery: "jewellery",
  jewelry: "jewellery",
  necklace: "jewellery",
  necklaces: "jewellery",
  earrings: "jewellery",
  earring: "jewellery",
  bangles: "jewellery",
  bangle: "jewellery",
};

function extractMaxPrice(message: string): number | null {
  const match = message.match(
    /under\s*(?:rs\.?|inr|₹)?\s*([\d,]{3,7})/i
  );

  if (!match) {
    return null;
  }

  const value = Number(match[1].replace(/,/g, ""));

  return Number.isFinite(value) ? value : null;
}

function extractOccasion(message: string): string | null {
  const normalized = message.toLowerCase();

  for (const occasion of OCCASIONS) {
    if (normalized.includes(occasion.toLowerCase())) {
      return occasion;
    }
  }

  return null;
}

export function extractColor(message: string): string | null {
  const normalized = message.toLowerCase();

  for (const color of COLOR_WORDS) {
    if (normalized.includes(color)) {
      return color;
    }
  }

  return null;
}

export function extractCategorySlug(message: string): string | null {
  const words = message
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const word of words) {
    const category = CATEGORY_SYNONYMS[word];

    if (category) {
      return category;
    }
  }

  return null;
}

/** Human-readable label for a category slug. */
export function getCategoryLabel(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

const FASHION_KEYWORDS = [
  "saree",
  "sari",
  "lehenga",
  "lehnga",
  "lengha",
  "dress",
  "gown",
  "jewellery",
  "jewelry",
  "necklace",
  "earring",
  "bangle",
  "suit",
  "anarkali",
  "dupatta",
  "fabric",
  "silk",
  "cotton",
  "velvet",
  "chiffon",
  "georgette",
  "organza",
  "crepe",
  "zari",
  "embroidery",
  "wedding",
  "bridal",
  "reception",
  "mehendi",
  "sangeet",
  "festive",
  "diwali",
  "cocktail",
  "party",
  "formal",
  "casual",
  "price",
  "under",
  "budget",
  "cost",
  "inr",
  "rupees",
  "collection",
  "wear",
  "outfit",
  "attire",
  "style",
  "recommend",
  "show",
  "buy",
  "shop",
  "looking for",
  "piece",
  "pieces",
];

/**
 * Checks whether user message is asking for products, apparel, or shopping advice.
 */
export function isProductRelatedQuery(message: string): boolean {
  const norm = message.toLowerCase();
  return (
    Boolean(extractCategorySlug(message)) ||
    Boolean(extractOccasion(message)) ||
    Boolean(extractColor(message)) ||
    Boolean(extractMaxPrice(message)) ||
    FASHION_KEYWORDS.some((kw) => norm.includes(kw))
  );
}

/** Describes what filters were applied and how the results relate to them. */
export interface RetrievalMeta {
  /** The filters the user explicitly asked for. */
  requestedColor: string | null;
  requestedCategory: string | null;
  requestedOccasion: string | null;
  requestedMaxPrice: number | null;
  /**
   * - "exact": every filter matched.
   * - "relaxed": some filters were dropped to broaden the search (explained via `relaxedNote`).
   * - "text": full-text keyword search was used (no explicit filters detected).
   * - "none": no products matched at all.
   */
  matchType: "exact" | "relaxed" | "text" | "none";
  /** Human-readable note explaining how filters were relaxed (only set when matchType === "relaxed"). */
  relaxedNote: string | null;
}

export interface RetrievalResult {
  products: ProductWithRelations[];
  meta: RetrievalMeta;
}

/**
 * Core product retrieval for the AI assistant.
 *
 * Strategy:
 * 1. Apply all explicit filters (color, category, occasion, price) strictly.
 * 2. If zero results and multiple filters were used, progressively relax
 *    ONE filter at a time and track which ones were dropped so the caller
 *    can produce honest messaging (e.g. "no green lehengas, here are green
 *    alternatives").
 * 3. If still zero and no explicit filters existed, fall back to text search.
 * 4. Never return random featured products when the user asked for something
 *    specific — return an explicit "no matches" result instead.
 */
export async function retrieveCandidateProducts(
  message: string,
  limit = 6
): Promise<RetrievalResult> {
  const supabase = await createClient();

  const occasion = extractOccasion(message);
  const color = extractColor(message);
  const maxPrice = extractMaxPrice(message);
  const categorySlug = extractCategorySlug(message);

  const meta: RetrievalMeta = {
    requestedColor: color,
    requestedCategory: categorySlug ? getCategoryLabel(categorySlug) : null,
    requestedOccasion: occasion,
    requestedMaxPrice: maxPrice,
    matchType: "exact",
    relaxedNote: null,
  };

  const explicitFilters: string[] = [];
  if (color) explicitFilters.push("color");
  if (categorySlug) explicitFilters.push("category");
  if (occasion) explicitFilters.push("occasion");
  if (maxPrice !== null) explicitFilters.push("price");

  const hasExplicitFilter = explicitFilters.length > 0;

  // --- Resolve category slug to ID once ---
  let categoryId: string | null = null;
  if (categorySlug) {
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();

    if (categoryError || !category) {
      // Unknown category — cannot find exact matches
      meta.matchType = "none";
      meta.relaxedNote = `We don't carry a "${categorySlug}" category in our collection.`;
      return { products: [], meta };
    }
    categoryId = category.id;
  }

  // --- Helper: run a filtered query ---
  async function runQuery(opts: {
    applyColor?: boolean;
    applyCategory?: boolean;
    applyOccasion?: boolean;
    applyPrice?: boolean;
  }): Promise<ProductWithRelations[]> {
    let query = supabase
      .from("products")
      .select(
        "*, category:categories(*), images:product_images(*), variants:product_variants(*)"
      )
      .eq("active", true);

    if (opts.applyOccasion && occasion) {
      query = query.contains("occasion_tags", [occasion]);
    }
    if (opts.applyColor && color) {
      query = query.ilike("color_family", `%${color}%`);
    }
    if (opts.applyPrice && typeof maxPrice === "number") {
      query = query.lte("base_price", maxPrice);
    }
    if (opts.applyCategory && categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query.limit(limit);
    if (error) return [];
    return (data ?? []) as unknown as ProductWithRelations[];
  }

  // --- Step 1: Exact match with ALL explicit filters ---
  let products = await runQuery({
    applyColor: true,
    applyCategory: true,
    applyOccasion: true,
    applyPrice: true,
  });

  if (products.length > 0) {
    meta.matchType = "exact";
    return { products: sortImages(products), meta };
  }

  // --- Step 2: Progressive relaxation (only if multiple filters) ---
  if (explicitFilters.length >= 2) {
    // Strategy: try dropping category first (keep color), then drop color (keep category)
    // This way "green lehenga" with 0 results → "green outfits" → "any lehenga"

    if (color && categorySlug) {
      // 2a. Keep color, drop category
      const colorOnly = await runQuery({
        applyColor: true,
        applyCategory: false,
        applyOccasion: true,
        applyPrice: true,
      });
      if (colorOnly.length > 0) {
        meta.matchType = "relaxed";
        meta.relaxedNote = `We don't have ${color} ${getCategoryLabel(categorySlug).toLowerCase()} right now, but here are ${color}-toned pieces from our collection.`;
        return { products: sortImages(colorOnly), meta };
      }

      // 2b. Keep category, drop color
      const catOnly = await runQuery({
        applyColor: false,
        applyCategory: true,
        applyOccasion: true,
        applyPrice: true,
      });
      if (catOnly.length > 0) {
        meta.matchType = "relaxed";
        meta.relaxedNote = `We don't currently carry ${color} ${getCategoryLabel(categorySlug).toLowerCase()}, but here are other ${getCategoryLabel(categorySlug).toLowerCase()} you might love.`;
        return { products: sortImages(catOnly), meta };
      }
    }

    // 2c. Drop all attribute filters, keep only category or color
    if (occasion || maxPrice !== null) {
      const relaxed = await runQuery({
        applyColor: Boolean(color),
        applyCategory: Boolean(categoryId),
        applyOccasion: false,
        applyPrice: false,
      });
      if (relaxed.length > 0) {
        meta.matchType = "relaxed";
        const parts: string[] = [];
        if (color) parts.push(color);
        if (categorySlug) parts.push(getCategoryLabel(categorySlug).toLowerCase());
        meta.relaxedNote = `Exact match not found. Showing ${parts.join(" ")} options without the occasion/price filter.`;
        return { products: sortImages(relaxed), meta };
      }
    }
  }

  // --- Step 3: Text keyword search (only if no explicit filters were detected) ---
  if (!hasExplicitFilter) {
    const words = message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 6);

    if (words.length > 0) {
      const orFilter = words
        .map(
          (word) =>
            `name.ilike.%${word}%,description.ilike.%${word}%,material.ilike.%${word}%,color_family.ilike.%${word}%`
        )
        .join(",");

      const { data: fallback } = await supabase
        .from("products")
        .select(
          "*, category:categories(*), images:product_images(*), variants:product_variants(*)"
        )
        .eq("active", true)
        .or(orFilter)
        .limit(limit);

      const textResults = (fallback ?? []) as unknown as ProductWithRelations[];
      if (textResults.length > 0) {
        meta.matchType = "text";
        return { products: sortImages(textResults), meta };
      }
    }

    // Last resort for non-filtered shopping queries: show featured
    if (isProductRelatedQuery(message)) {
      const { data: featured } = await supabase
        .from("products")
        .select(
          "*, category:categories(*), images:product_images(*), variants:product_variants(*)"
        )
        .eq("active", true)
        .order("featured", { ascending: false })
        .limit(limit);

      const featuredProducts = (featured ?? []) as unknown as ProductWithRelations[];
      if (featuredProducts.length > 0) {
        meta.matchType = "text";
        return { products: sortImages(featuredProducts), meta };
      }
    }
  }

  // --- Step 4: Nothing found with explicit filters — return honest "none" ---
  meta.matchType = "none";
  if (color && categorySlug) {
    meta.relaxedNote = `We currently don't have any ${color} ${getCategoryLabel(categorySlug).toLowerCase()} in stock. Try browsing our full ${getCategoryLabel(categorySlug).toLowerCase()} collection or ask about a different colour.`;
  } else if (color) {
    meta.relaxedNote = `We couldn't find any ${color} pieces in stock right now. Try a different colour or browse our full collection.`;
  } else if (categorySlug) {
    meta.relaxedNote = `We couldn't find matching ${getCategoryLabel(categorySlug).toLowerCase()} right now. Try browsing our full collection.`;
  }

  return { products: [], meta };
}

function sortImages(products: ProductWithRelations[]): ProductWithRelations[] {
  return products.map((product) => ({
    ...product,
    images: [...(product.images ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order
    ),
  }));
}

/**
 * Strips a product down to only what Gemini needs to reason and never leaks
 * internal fields. Trims description for optimal token usage.
 */
export function toAiContext(product: ProductWithRelations) {
  const inStock = product.variants.some((v) => v.active && v.stock_quantity > 0);
  const compactDescription = (
    product.short_description ||
    product.description ||
    ""
  )
    .slice(0, 140)
    .trim();

  return {
    productId: product.id,
    name: product.name,
    category: product.category?.name ?? "",
    description: compactDescription,
    price: product.base_price,
    colorFamily: product.color_family,
    material: product.material,
    occasionTags: product.occasion_tags,
    inStock,
    sizesAvailable: Array.from(
      new Set(product.variants.filter((v) => v.active && v.stock_quantity > 0).map((v) => v.size))
    ),
  };
}