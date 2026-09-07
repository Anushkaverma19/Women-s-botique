import { createClient } from "@/lib/supabase/server";
import type { Category, ProductWithRelations } from "@/types/database";

export const PAGE_SIZE = 12;

export interface ProductFilters {
  q?: string;
  category?: string;
  color?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  occasion?: string;
  sort?: "featured" | "newest" | "price_asc" | "price_desc";
  page?: number;
}

export interface ProductListResult {
  products: ProductWithRelations[];
  total: number;
  page: number;
  pageCount: number;
}

/**
 * Database-backed catalogue query with search, filters, sorting and
 * pagination. This is the ONLY way product listings are produced - there is
 * no hardcoded product array anywhere in the app.
 */
export async function listProducts(filters: ProductFilters): Promise<ProductListResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("products")
    .select(
      "*, category:categories(*), images:product_images(*), variants:product_variants(*)",
      { count: "exact" }
    )
    .eq("active", true);

  if (filters.category) {
    // Resolve the category slug to an id first - PostgREST can't reliably
    // filter on a joined table's column when also selecting that join.
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", filters.category)
      .maybeSingle();
    if (cat) {
      query = query.eq("category_id", cat.id);
    } else {
      return { products: [], total: 0, page, pageCount: 0 };
    }
  }

  if (filters.q) {
    const term = filters.q.trim();
    query = query.or(
      `name.ilike.%${term}%,description.ilike.%${term}%,material.ilike.%${term}%,color_family.ilike.%${term}%`
    );
  }

  if (filters.color) {
    query = query.ilike("color_family", filters.color);
  }

  if (filters.occasion) {
    query = query.contains("occasion_tags", [filters.occasion]);
  }

  if (typeof filters.minPrice === "number") {
    query = query.gte("base_price", filters.minPrice);
  }
  if (typeof filters.maxPrice === "number") {
    query = query.lte("base_price", filters.maxPrice);
  }

  switch (filters.sort) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "price_asc":
      query = query.order("base_price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("base_price", { ascending: false });
      break;
    case "featured":
    default:
      query = query.order("featured", { ascending: false }).order("created_at", { ascending: false });
      break;
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("listProducts error", error.message);
    return { products: [], total: 0, page, pageCount: 0 };
  }

  let products = (data ?? []) as unknown as ProductWithRelations[];

  // Post-filter for size and stock: these depend on the variants array
  // which PostgREST can't cleanly filter with EXISTS-style semantics
  // through a nested select, so we apply them after the page is fetched.
  if (filters.size) {
    products = products.filter((p) =>
      p.variants.some((v) => v.size === filters.size && v.active)
    );
  }
  if (filters.inStock) {
    products = products.filter((p) => p.variants.some((v) => v.active && v.stock_quantity > 0));
  }

  products = products.map((p) => ({
    ...p,
    images: [...p.images].sort((a, b) => a.sort_order - b.sort_order),
  }));

  const total = count ?? products.length;
  return { products, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getProductBySlug(slug: string): Promise<ProductWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;

  const product = data as unknown as ProductWithRelations;
  product.images = [...product.images].sort((a, b) => a.sort_order - b.sort_order);
  return product;
}

export async function getFeaturedProducts(limit = 8): Promise<ProductWithRelations[]> {
  const { products } = await listProducts({ sort: "featured", page: 1 });
  return products.filter((p) => p.featured).slice(0, limit);
}

export async function getRelatedProducts(
  product: ProductWithRelations,
  limit = 4
): Promise<ProductWithRelations[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("category_id", product.category_id)
    .eq("active", true)
    .neq("id", product.id)
    .limit(limit);

  return ((data ?? []) as unknown as ProductWithRelations[]).map((p) => ({
    ...p,
    images: [...p.images].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("name");
  return data ?? [];
}

export async function getProductsByOccasion(
  occasion: string,
  limit = 8
): Promise<ProductWithRelations[]> {
  const { products } = await listProducts({ occasion, sort: "featured", page: 1 });
  return products.slice(0, limit);
}
