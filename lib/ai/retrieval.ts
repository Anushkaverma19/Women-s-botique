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

export const OUT_OF_SCOPE_PATTERNS = [
  {
    category: "footwear (shoes, sandals, heels)",
    regex: /\b(?:shoes?|footwear|sneakers?|sandals?|heels?|boots?|slippers?|loafers?|flats?|stilettos?)\b/i,
  },
  {
    category: "handbags & luggage",
    regex: /\b(?:handbags?|bags?|purses?|clutches?|backpacks?|tote\s*bags?|wallets?|luggage|suitcases?)\b/i,
  },
  {
    category: "electronics & gadgets",
    regex: /\b(?:phones?|iphones?|androids?|smartphones?|laptops?|computers?|macbooks?|tablets?|ipads?|electronics?|tvs?|televisions?|headphones?|earphones?|airpods?|smartwatch(?:es)?|watches|chargers?|cameras?)\b/i,
  },
  {
    category: "cosmetics & beauty products",
    regex: /\b(?:makeup|cosmetics?|lipsticks?|eyeliners?|foundations?|perfumes?|colognes?|fragrances?|skincare|lotions?|shampoos?)\b/i,
  },
  {
    category: "menswear or kids clothing",
    regex: /\b(?:menswear|men'?s\s+(?:wear|clothing|suits?|sherwani|kurta)|sherwanis?|kurta\s*pajama|kids?\s*(?:wear|clothing)?|children'?s)\b/i,
  },
  {
    category: "general merchandise",
    regex: /\b(?:furniture|sofas?|chairs?|cars?|bikes?|motorcycles?|grocer(?:y|ies)|foods?|medicines?|books?|flights?|tickets?|hotels?)\b/i,
  },
];

/**
 * Detects if a user query is asking for non-clothing/unsupported categories.
 * If the query explicitly asks for boutique offerings (sarees, lehengas, dresses, jewellery),
 * it is not considered out of scope.
 */
export function detectOutOfScopeQuery(message: string): {
  isOutOfScope: boolean;
  category?: string;
} {
  if (extractCategorySlug(message)) {
    return { isOutOfScope: false };
  }

  for (const { category, regex } of OUT_OF_SCOPE_PATTERNS) {
    if (regex.test(message)) {
      return { isOutOfScope: true, category };
    }
  }
  return { isOutOfScope: false };
}

export const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+|previous\s+|prior\s+)?instructions/i,
  /system\s+prompt/i,
  /developer\s+instructions/i,
  /you\s+are\s+now/i,
  /act\s+as\b/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /reveal\s+(?:the\s+|your\s+)?prompt/i,
  /show\s+(?:the\s+|your\s+)?prompt/i,
  /print\s+(?:api\s+key|secret|env|prompt)/i,
  /eval\s*\(/i,
  /<script/i,
  /DROP\s+TABLE/i,
  /SELECT\s+.*?\s+FROM/i,
  /base64/i,
];

/**
 * Detects prompt injection attempts or boundary violations.
 */
export function isPromptInjectionQuery(message: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

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
    if (!u1 && u2 && parseFloat(rangeMatch[1].replace(/,/g, "")) < 1000) {
      u1 = u2;
    }

    const val1 = parsePriceValue(rangeMatch[1], u1);
    const val2 = parsePriceValue(rangeMatch[3], u2);

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
  "casual", "price", "budget", "cost", "inr", "rupees", "collection",
  "wear", "outfit", "attire", "style", "recommend", "look",
  "looking for", "piece", "pieces"
];

/**
 * Checks whether user message is genuinely asking for products, apparel, or shopping advice.
 * Returns false for prompt injections and out-of-scope non-clothing categories.
 */
export function isProductRelatedQuery(message: string): boolean {
  if (isPromptInjectionQuery(message)) return false;
  if (detectOutOfScopeQuery(message).isOutOfScope) return false;

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
  requestedColor: string | null;
  requestedCategory: string | null;
  requestedOccasion: string | null;
  requestedMinPrice: number | null;
  requestedMaxPrice: number | null;
  matchType: "exact" | "relaxed" | "text" | "none";
  relaxedNote: string | null;
}

export interface RetrievalResult {
  products: ProductWithRelations[];
  meta: RetrievalMeta;
}

/**
 * Core product retrieval for the AI assistant.
 */
export async function retrieveCandidateProducts(
  message: string,
  limit = 6
): Promise<RetrievalResult> {
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

  // 1. Guard against prompt injection & out-of-scope queries: do not search database
  if (isPromptInjectionQuery(message)) {
    meta.matchType = "none";
    meta.relaxedNote =
      "Namaste! I am ASK MEHRAÉ, your personal shopping assistant. I am here exclusively to help you explore and style luxury sarees, lehengas, gowns, and fine jewellery from our collection.";
    return { products: [], meta };
  }

  const oos = detectOutOfScopeQuery(message);
  if (oos.isOutOfScope) {
    meta.matchType = "none";
    meta.relaxedNote = `MEHRAÉ specializes exclusively in handcrafted Indian luxury womenswear—including luxury sarees, bespoke bridal & festive lehengas, contemporary gowns, and fine statement jewellery. We do not carry ${oos.category}. Please explore our couture apparel and jewellery collections!`;
    return { products: [], meta };
  }

  const supabase = await createClient();

  const explicitFilters: string[] = [];
  if (color) explicitFilters.push("color");
  if (categorySlug) explicitFilters.push("category");
  if (occasion) explicitFilters.push("occasion");
  if (minPrice !== null || maxPrice !== null) explicitFilters.push("price");

  const hasExplicitFilter = explicitFilters.length > 0;

  // 2. Store-wide Price Range Validation
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
      meta.matchType = "none";
      meta.relaxedNote =
        "We currently don't have products in that price range. Our collection ranges from ₹5,000 to ₹75,000.";
      return { products: [], meta };
    }
  }

  // 3. Resolve category slug to ID once
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

  // Helper: run a strictly filtered query
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

  // Step 1: Exact match with ALL explicit filters
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

  // Step 2: Progressive Relaxation Protocol
  if (explicitFilters.length >= 2) {
    if (color && categorySlug) {
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

      meta.matchType = "none";
      meta.relaxedNote = `No ${color} ${getCategoryLabel(categorySlug).toLowerCase()} found in our collection. Try exploring our other ${getCategoryLabel(categorySlug).toLowerCase()} or browsing by colour.`;
      return { products: [], meta };
    }

    if (categorySlug && (minPrice !== null || maxPrice !== null)) {
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

    if (color && (minPrice !== null || maxPrice !== null)) {
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

  // Step 3: Single filter zero-result cases
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

  // Step 4: Text keyword search (ONLY if NO explicit filters were detected and query is a genuine shopping query)
  if (!hasExplicitFilter && isProductRelatedQuery(message)) {
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
  }

  // Step 5: Honest "none"
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