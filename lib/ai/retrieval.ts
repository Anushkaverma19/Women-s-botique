import { createClient } from "@/lib/supabase/server";
import type { ProductWithRelations } from "@/types/database";
import { OCCASIONS } from "@/types/database";

export const COLOR_SYNONYMS: Record<string, string[]> = {
  green: ["green", "emerald", "olive", "mint", "sage", "mehendi", "pistachio", "teal"],
  emerald: ["emerald", "green"],
  red: ["red", "crimson", "scarlet", "ruby", "vermilion", "maroon", "cherry"],
  burgundy: ["burgundy", "wine", "maroon", "berry", "plum"],
  pink: ["pink", "rose", "blush", "fuchsia", "magenta", "rani"],
  magenta: ["magenta", "rani", "fuchsia", "pink"],
  blue: ["blue", "navy", "indigo", "royal blue", "midnight", "midnight blue", "azure"],
  yellow: ["yellow", "mustard", "ochre", "haldi", "gold", "canary"],
  gold: ["gold", "golden", "metallic", "yellow"],
  silver: ["silver", "grey", "gray", "metallic"],
  grey: ["grey", "gray", "silver", "ash", "charcoal"],
  gray: ["gray", "grey", "silver", "ash", "charcoal"],
  black: ["black", "onyx", "ebony", "noir"],
  white: ["white", "ivory", "off-white", "cream"],
  ivory: ["ivory", "white", "cream", "off-white"],
  purple: ["purple", "violet", "plum", "lavender", "mauve", "wine", "shimmer"],
  violet: ["violet", "purple", "shimmer", "lavender"],
  orange: ["orange", "rust", "terracotta", "peach", "coral", "tangerine"],
  coral: ["coral", "peach", "orange"],
  peach: ["peach", "coral", "blush"],
  teal: ["teal", "turquoise", "peacock blue", "green", "blue"],
  maroon: ["maroon", "burgundy", "wine", "red"],
  multicolour: ["multicolour", "multicolor", "multi", "printed"],
  multicolor: ["multicolor", "multicolour", "multi", "printed"],
};

const COLOR_WORDS = Object.keys(COLOR_SYNONYMS);

export const CATEGORY_SYNONYMS: Record<string, string> = {
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

/**
 * Parses numeric text with optional Indian or metric multipliers (e.g., '10 lakhs' -> 1000000, '15k' -> 15000).
 */
export function parsePriceValue(numStr: string, unitStr?: string): number | null {
  const num = parseFloat(numStr.replace(/,/g, ""));
  if (isNaN(num)) return null;

  const unit = (unitStr || "").toLowerCase().trim();
  if (unit === "k" || unit.startsWith("thousand")) {
    return Math.round(num * 1_000);
  }
  if (unit.startsWith("lakh") || unit.startsWith("lac")) {
    return Math.round(num * 100_000);
  }
  if (unit.startsWith("crore") || unit === "cr") {
    return Math.round(num * 10_000_000);
  }
  return Math.round(num);
}

/**
 * Extracts structured numerical min and max price constraints from natural language.
 *
 * Supported formats:
 * - "above 10 lakhs" -> minPrice: 1000000
 * - "under 15k" -> maxPrice: 15000
 * - "between 10k and 20k" -> minPrice: 10000, maxPrice: 20000
 * - "from 15000 to 25000" -> minPrice: 15000, maxPrice: 25000
 * - "more than 50,000", "over 20k", "greater than 30k", "at least 15k", "starting from 15k"
 * - "below 20k", "less than 25k", "up to 30k", "max 40k", "within 20k", "budget 15k"
 */
export function extractPriceRange(message: string): {
  minPrice: number | null;
  maxPrice: number | null;
} {
  const norm = message.toLowerCase();
  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  // 1. Check Range: "between X and Y", "from X to Y", "X to Y", "X - Y", "X-Y"
  const rangeMatch = norm.match(
    /(?:between|from|budget\s*of)?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|thousand|thousands|lakh|lakhs|lac|lacs|crore|crores|cr)?\s*(?:to|-|and)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|thousand|thousands|lakh|lakhs|lac|lacs|crore|crores|cr)?/i
  );

  if (rangeMatch) {
    let u1 = rangeMatch[2];
    const u2 = rangeMatch[4];
    // Inherit unit e.g. "10 to 20k" -> u1 is "k"
    if (!u1 && u2 && parseFloat(rangeMatch[1].replace(/,/g, "")) < 1000) {
      u1 = u2;
    }

    const val1 = parsePriceValue(rangeMatch[1], u1);
    const val2 = parsePriceValue(rangeMatch[3], u2);

    // Guard against non-price plain numbers (e.g. "size 38 and 40")
    const hasCurrency = /(?:rs\.?|inr|₹)/i.test(rangeMatch[0]);
    const hasUnit = Boolean(u1 || u2);
    const hasPrefix = /(?:between|from|budget|price)/i.test(rangeMatch[0]);
    const isLikelyPrice = hasCurrency || hasUnit || hasPrefix || (val1 !== null && val1 >= 500) || (val2 !== null && val2 >= 500);

    if (val1 !== null && val2 !== null && isLikelyPrice) {
      minPrice = Math.min(val1, val2);
      maxPrice = Math.max(val1, val2);
      return { minPrice, maxPrice };
    }
  }

  // 2. Check Min: above, more than, over, greater than, at least, minimum, min, starting from, starts from
  const minMatch = norm.match(
    /(?:above|more than|over|greater than|at least|minimum|min|starting from|starts from)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|thousand|thousands|lakh|lakhs|lac|lacs|crore|crores|cr)?\b/i
  );
  if (minMatch) {
    minPrice = parsePriceValue(minMatch[1], minMatch[2]);
  }

  // 3. Check Max: under, below, less than, up to, max, maximum, within, budget (of)?
  const maxMatch = norm.match(
    /(?:under|below|less than|up to|max|maximum|within|budget(?:\s*of)?)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|thousand|thousands|lakh|lakhs|lac|lacs|crore|crores|cr)?\b/i
  );
  if (maxMatch) {
    maxPrice = parsePriceValue(maxMatch[1], maxMatch[2]);
  }

  // 4. Standalone budget/price target: "for 10 lakhs", "around 15k", "priced at 20k"
  if (minPrice === null && maxPrice === null) {
    const targetMatch = norm.match(
      /(?:for|around|approx(?:imately)?|priced\s*at)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|thousand|thousands|lakh|lakhs|lac|lacs|crore|crores|cr)?\b/i
    );
    if (targetMatch) {
      const targetVal = parsePriceValue(targetMatch[1], targetMatch[2]);
      if (targetVal !== null) {
        // Range within ±25% of target
        minPrice = Math.round(targetVal * 0.75);
        maxPrice = Math.round(targetVal * 1.25);
      }
    }
  }

  return { minPrice, maxPrice };
}

export function extractOccasion(message: string): string | null {
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
  // Check exact word boundaries so "red" doesn't match inside "tailored"
  for (const color of COLOR_WORDS) {
    if (new RegExp(`\\b${color}\\b`, "i").test(normalized)) {
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
  "saree", "sari", "lehenga", "lehnga", "lengha", "dress", "gown",
  "jewellery", "jewelry", "necklace", "earring", "bangle", "suit", "anarkali",
  "dupatta", "fabric", "silk", "cotton", "velvet", "chiffon", "georgette",
  "organza", "crepe", "zari", "embroidery", "wedding", "bridal", "reception",
  "mehendi", "sangeet", "festive", "diwali", "cocktail", "party", "formal",
  "casual", "price", "under", "budget", "cost", "inr", "rupees", "collection",
  "wear", "outfit", "attire", "style", "recommend", "show", "buy", "shop",
  "looking for", "piece", "pieces", "lakh", "lakhs", "crore"
];

/**
 * Checks whether user message is asking for products, apparel, or shopping advice.
 */
export function isProductRelatedQuery(message: string): boolean {
  const norm = message.toLowerCase();
  const priceRange = extractPriceRange(message);
  return (
    Boolean(extractCategorySlug(message)) ||
    Boolean(extractOccasion(message)) ||
    Boolean(extractColor(message)) ||
    priceRange.minPrice !== null ||
    priceRange.maxPrice !== null ||
    FASHION_KEYWORDS.some((kw) => norm.includes(kw))
  );
}

/** Describes what filters were applied and how the results relate to them. */
export interface RetrievalMeta {
  /** The filters the user explicitly asked for. */
  requestedColor: string | null;
  requestedCategory: string | null;
  requestedOccasion: string | null;
  requestedMinPrice: number | null;
  requestedMaxPrice: number | null;
  /**
   * - "exact": every filter matched.
   * - "relaxed": some filters were dropped to broaden the search (explained via `relaxedNote`).
   * - "text": full-text keyword search was used (no explicit filters detected).
   * - "none": no products matched at all.
   */
  matchType: "exact" | "relaxed" | "text" | "none";
  /** Human-readable note explaining how filters were relaxed (only set when matchType === "relaxed" or "none"). */
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
 * 1. Extract and strictly parse price bounds (minPrice & maxPrice), category, color, and occasion.
 * 2. If a price filter is provided and 0 products in the boutique match that price filter
 *    (e.g., above 10 Lakhs when collection is under 1 Lakh), immediately return
 *    matchType: "none" with:
 *    "We currently don't have products in that price range. Our collection ranges from ₹5,000 to ₹75,000."
 * 3. Color filtering utilizes comprehensive synonym expansion (e.g. green matches emerald, olive, mint).
 * 4. If zero exact matches exist for combined filters (e.g., "green lehenga"), progressively relax:
 *    - color + price across other categories (e.g., green emerald dresses), with explicit context note.
 *    - category + price across other colors, with explicit context note.
 *    - If neither returns results: return matchType: "none" ("No green lehengas found in our collection").
 * 5. NEVER return random fallback products when explicit filters are requested.
 */
export async function retrieveCandidateProducts(
  message: string,
  limit = 6
): Promise<RetrievalResult> {
  const supabase = await createClient();

  const occasion = extractOccasion(message);
  const color = extractColor(message);
  const { minPrice, maxPrice } = extractPriceRange(message);
  const categorySlug = extractCategorySlug(message);

  const meta: RetrievalMeta = {
    requestedColor: color,
    requestedCategory: categorySlug ? getCategoryLabel(categorySlug) : null,
    requestedOccasion: occasion,
    requestedMinPrice: minPrice,
    requestedMaxPrice: maxPrice,
    matchType: "exact",
    relaxedNote: null,
  };

  const explicitFilters: string[] = [];
  if (color) explicitFilters.push("color");
  if (categorySlug) explicitFilters.push("category");
  if (occasion) explicitFilters.push("occasion");
  if (minPrice !== null || maxPrice !== null) explicitFilters.push("price");

  const hasExplicitFilter = explicitFilters.length > 0;

  // --- 1. Store-wide Price Range Validation ---
  // If price bounds are specified, verify if ANY active products in the boutique match the price range.
  if (minPrice !== null || maxPrice !== null) {
    let priceCheck = supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("active", true);

    if (typeof minPrice === "number") {
      priceCheck = priceCheck.gte("base_price", minPrice);
    }
    if (typeof maxPrice === "number") {
      priceCheck = priceCheck.lte("base_price", maxPrice);
    }

    const { count: storePriceCount } = await priceCheck;
    if (storePriceCount === 0 || storePriceCount === null) {
      // Zero products in the boutique match the price filter!
      // Do NOT display random fallback products.
      meta.matchType = "none";
      meta.relaxedNote =
        "We currently don't have products in that price range. Our collection ranges from ₹5,000 to ₹75,000.";
      return { products: [], meta };
    }
  }

  // --- 2. Resolve category slug to ID once ---
  let categoryId: string | null = null;
  if (categorySlug) {
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();

    if (categoryError || !category) {
      meta.matchType = "none";
      meta.relaxedNote = `We don't carry a "${categorySlug}" category in our collection.`;
      return { products: [], meta };
    }
    categoryId = category.id;
  }

  // --- Helper: run a strictly filtered query ---
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
      const syns = COLOR_SYNONYMS[color] || [color];
      // Match color_family and product name for all synonyms
      const orParts = syns
        .flatMap((s) => [`color_family.ilike.%${s}%`, `name.ilike.%${s}%`])
        .join(",");
      query = query.or(orParts);
    }

    if (opts.applyPrice) {
      if (typeof minPrice === "number") {
        query = query.gte("base_price", minPrice);
      }
      if (typeof maxPrice === "number") {
        query = query.lte("base_price", maxPrice);
      }
    }

    if (opts.applyCategory && categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query.limit(limit);
    if (error) return [];
    return (data ?? []) as unknown as ProductWithRelations[];
  }

  // --- Step 1: Exact match with ALL explicit filters ---
  const exactProducts = await runQuery({
    applyColor: true,
    applyCategory: true,
    applyOccasion: true,
    applyPrice: true,
  });

  if (exactProducts.length > 0) {
    meta.matchType = "exact";
    return { products: sortImages(exactProducts), meta };
  }

  // --- Step 2: Progressive Relaxation Protocol ---
  if (explicitFilters.length >= 2) {
    // 2a. Both Color and Category were requested (e.g. "green lehenga")
    if (color && categorySlug) {
      // Try keeping color + price, dropping category (e.g. green dresses / sarees within budget)
      const colorMatches = await runQuery({
        applyColor: true,
        applyCategory: false,
        applyOccasion: true,
        applyPrice: true,
      });

      if (colorMatches.length > 0) {
        meta.matchType = "relaxed";
        meta.relaxedNote = `We don't currently have ${color} ${getCategoryLabel(categorySlug).toLowerCase()} in stock, but here are beautiful ${color}-toned pieces from our collection you might love:`;
        return { products: sortImages(colorMatches), meta };
      }

      // Try keeping category + price, dropping color (e.g. other lehengas within budget)
      const categoryMatches = await runQuery({
        applyColor: false,
        applyCategory: true,
        applyOccasion: true,
        applyPrice: true,
      });

      if (categoryMatches.length > 0) {
        meta.matchType = "relaxed";
        meta.relaxedNote = `We don't currently have ${color} ${getCategoryLabel(categorySlug).toLowerCase()}, but here are other exquisite ${getCategoryLabel(categorySlug).toLowerCase()} from our collection:`;
        return { products: sortImages(categoryMatches), meta };
      }

      // Neither returned results
      meta.matchType = "none";
      meta.relaxedNote = `No ${color} ${getCategoryLabel(categorySlug).toLowerCase()} found in our collection. Try exploring our other ${getCategoryLabel(categorySlug).toLowerCase()} or browsing by colour.`;
      return { products: [], meta };
    }

    // 2b. Category + Price requested (e.g. "lehengas under 15k")
    if (categorySlug && (minPrice !== null || maxPrice !== null)) {
      // Find other items in that price budget
      const budgetAlternatives = await runQuery({
        applyColor: false,
        applyCategory: false,
        applyOccasion: true,
        applyPrice: true,
      });

      if (budgetAlternatives.length > 0) {
        meta.matchType = "relaxed";
        meta.relaxedNote = `We don't currently have ${getCategoryLabel(categorySlug).toLowerCase()} in that price range, but here are curated pieces within your budget from our collection:`;
        return { products: sortImages(budgetAlternatives), meta };
      }

      meta.matchType = "none";
      meta.relaxedNote = `We don't have ${getCategoryLabel(categorySlug).toLowerCase()} in that price range. Try expanding your budget or exploring our other collections.`;
      return { products: [], meta };
    }

    // 2c. Color + Price requested (e.g. "green under 10k")
    if (color && (minPrice !== null || maxPrice !== null)) {
      // Check any color pieces
      const colorPieces = await runQuery({
        applyColor: true,
        applyCategory: false,
        applyOccasion: false,
        applyPrice: false,
      });

      if (colorPieces.length > 0) {
        meta.matchType = "relaxed";
        meta.relaxedNote = `We don't currently have ${color} pieces in that specific price range, but here are stunning ${color} designs from our collection:`;
        return { products: sortImages(colorPieces), meta };
      }

      meta.matchType = "none";
      meta.relaxedNote = `No ${color} pieces found in that price range. Try a different colour or browse our full catalogue.`;
      return { products: [], meta };
    }
  }

  // --- Step 3: Single filter zero-result cases ---
  if (color && !categorySlug) {
    meta.matchType = "none";
    meta.relaxedNote = `No ${color} pieces found in our collection. Try exploring other colours or browse our full catalogue.`;
    return { products: [], meta };
  }

  if (categorySlug && !color) {
    meta.matchType = "none";
    meta.relaxedNote = `No matching ${getCategoryLabel(categorySlug).toLowerCase()} found in our collection right now.`;
    return { products: [], meta };
  }

  // --- Step 4: Text keyword search (ONLY if NO explicit filters were detected) ---
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

    // Last resort for general shopping queries without filters: show featured items
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

  // --- Step 5: Honest "none" ---
  meta.matchType = "none";
  meta.relaxedNote = "I wasn't able to find matching items in our current collection. Try a different colour, category, or budget.";
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