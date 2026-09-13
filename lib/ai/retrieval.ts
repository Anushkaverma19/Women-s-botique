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
  "multicolour",
  "multicolor",
];

/** Extracts a rough price ceiling like "under 10000" or "under ₹10,000". */
function extractMaxPrice(message: string): number | undefined {
  const match = message.match(/under\s*(?:rs\.?|inr|₹)?\s*([\d,]{3,7})/i);
  if (!match) return undefined;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

function extractOccasion(message: string): string | undefined {
  const lower = message.toLowerCase();
  return OCCASIONS.find((o) => lower.includes(o.replace("-", " ")) || lower.includes(o));
}

function extractColor(message: string): string | undefined {
  const lower = message.toLowerCase();
  return COLOR_WORDS.find((c) => lower.includes(c));
}

// Garment-type synonyms mapped to the real category slugs seeded in the
// database (see supabase/seed.sql). This was previously missing entirely:
// a message like "show me a lehenga for a wedding" only matched on the
// occasion word ("wedding") and never narrowed by garment type, so shoppers
// asking specifically for sarees/lehengas/dresses/jewellery could still get
// a mixed, generic set of products back. Matching category first is a much
// stronger relevance signal than the raw keyword fallback further down.
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

function extractCategorySlug(message: string): string | undefined {
  const words = message.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/);
  for (const word of words) {
    if (CATEGORY_SYNONYMS[word]) return CATEGORY_SYNONYMS[word];
  }
  return undefined;
}

/**
 * Retrieves a bounded, relevant set of ACTIVE products for Gemini to reason
 * over. This is the grounding step: Gemini will only ever be shown (and
 * therefore can only recommend) products returned from this function.
 */
export async function retrieveCandidateProducts(
  message: string,
  limit = 12
): Promise<ProductWithRelations[]> {
  const supabase = await createClient();

  const occasion = extractOccasion(message);
  const color = extractColor(message);
  const maxPrice = extractMaxPrice(message);
  const categorySlug = extractCategorySlug(message);

  let query = supabase
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("active", true);

  if (occasion) query = query.contains("occasion_tags", [occasion]);
  if (color) query = query.ilike("color_family", `%${color}%`);
  if (typeof maxPrice === "number") query = query.lte("base_price", maxPrice);
  if (categorySlug) {
    // category_id is nullable and the select above uses a left join
    // (categories(*), not categories!inner(*)) so existing uncategorised
    // products keep showing up for every other query - resolve the slug to
    // an id first rather than switching the join type, to avoid silently
    // dropping products from unrelated queries.
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();
    if (category) query = query.eq("category_id", category.id);
  }

  const { data } = await query.limit(limit);
  let products = (data ?? []) as unknown as ProductWithRelations[];

  // If the targeted filters returned nothing, fall back to a broad
  // full-text-ish search over the raw message, then to featured products -
  // always grounded in the real catalogue, never fabricated.
  if (products.length === 0) {
    const words = message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 6);

    if (words.length > 0) {
      const orFilter = words
        .map((w) => `name.ilike.%${w}%,description.ilike.%${w}%,material.ilike.%${w}%`)
        .join(",");
      const { data: fallback } = await supabase
        .from("products")
        .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
        .eq("active", true)
        .or(orFilter)
        .limit(limit);
      products = (fallback ?? []) as unknown as ProductWithRelations[];
    }
  }

  if (products.length === 0) {
    const { data: featured } = await supabase
      .from("products")
      .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
      .eq("active", true)
      .order("featured", { ascending: false })
      .limit(limit);
    products = (featured ?? []) as unknown as ProductWithRelations[];
  }

  return products.map((p) => ({
    ...p,
    images: [...p.images].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

/** Strips a product down to only what Gemini needs to reason and never leaks internal fields. */
export function toAiContext(product: ProductWithRelations) {
  const inStock = product.variants.some((v) => v.active && v.stock_quantity > 0);
  return {
    productId: product.id,
    name: product.name,
    shortDescription: product.short_description,
    basePrice: product.base_price,
    colorFamily: product.color_family,
    material: product.material,
    occasionTags: product.occasion_tags,
    inStock,
    sizesAvailable: Array.from(
      new Set(product.variants.filter((v) => v.active && v.stock_quantity > 0).map((v) => v.size))
    ),
  };
}
