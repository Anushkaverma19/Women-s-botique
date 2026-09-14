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

function extractColor(message: string): string | null {
  const normalized = message.toLowerCase();

  for (const color of COLOR_WORDS) {
    if (normalized.includes(color)) {
      return color;
    }
  }

  return null;
}

function extractCategorySlug(message: string): string | null {
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

export async function retrieveCandidateProducts(
  message: string,
  limit = 12
): Promise<ProductWithRelations[]> {
  const supabase = await createClient();

  const occasion = extractOccasion(message);
  const color = extractColor(message);
  const maxPrice = extractMaxPrice(message);
  const categorySlug = extractCategorySlug(message);

  const hasExplicitFilter =
    Boolean(occasion) ||
    Boolean(color) ||
    Boolean(categorySlug) ||
    typeof maxPrice === "number";

  let categoryId: string | null = null;

  if (categorySlug) {
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();

    if (categoryError || !category) {
      return [];
    }

    categoryId = category.id;
  }

  let query = supabase
    .from("products")
    .select(
      "*, category:categories(*), images:product_images(*), variants:product_variants(*)"
    )
    .eq("active", true);

  if (occasion) {
    query = query.contains("occasion_tags", [occasion]);
  }

  if (color) {
    query = query.ilike("color_family", `%${color}%`);
  }

  if (typeof maxPrice === "number") {
    query = query.lte("base_price", maxPrice);
  }

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    return [];
  }

  let products = (data ?? []) as unknown as ProductWithRelations[];

  if (products.length === 0 && !hasExplicitFilter) {
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
            `name.ilike.%${word}%,description.ilike.%${word}%,material.ilike.%${word}%`
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

      products = (fallback ?? []) as unknown as ProductWithRelations[];
    }
  }

  if (products.length === 0 && !hasExplicitFilter) {
    const { data: featured } = await supabase
      .from("products")
      .select(
        "*, category:categories(*), images:product_images(*), variants:product_variants(*)"
      )
      .eq("active", true)
      .order("featured", { ascending: false })
      .limit(limit);

    products = (featured ?? []) as unknown as ProductWithRelations[];
  }

  return products.map((product) => ({
    ...product,
    images: [...(product.images ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order
    ),
  }));
}

/**
 * Strips a product down to only what Gemini needs to reason and never leaks
 * internal fields.
 *
 * MUST stay a structured object with a literal `productId` field: the
 * system prompt (lib/ai/systemPrompt.ts) explicitly tells Gemini "PRODUCT
 * CONTEXT ... as JSON" and instructs it to copy "productId" exactly from
 * this context. A prior revision of this function returned a formatted
 * multi-line string per product (with the id on an "ID:" line instead of a
 * `productId` field), which silently broke that contract - Gemini had to
 * infer the field name and hand-transcribe a UUID out of prose instead of
 * copying a clean field, which is why recommendations were only right
 * *some* of the time. Keep this as a plain object.
 */
export function toAiContext(product: ProductWithRelations) {
  const inStock = product.variants.some((v) => v.active && v.stock_quantity > 0);
  return {
    productId: product.id,
    name: product.name,
    category: product.category?.name ?? "",
    description: product.description,
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