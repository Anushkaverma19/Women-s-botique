import { createClient } from "@/lib/supabase/server";
import type { Order, ProductWithRelations } from "@/types/database";

export interface DashboardStats {
  totalOrders: number;
  revenue: number;
  totalProducts: number;
  lowStockCount: number;
  recentOrders: Order[];
}

const LOW_STOCK_THRESHOLD = 3;

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const [{ count: totalOrders }, { data: paidOrders }, { count: totalProducts }, { count: lowStockCount }, { data: recentOrders }] =
    await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }),
      supabase.from("orders").select("total").eq("payment_status", "paid"),
      supabase.from("products").select("*", { count: "exact", head: true }).eq("active", true),
      supabase
        .from("product_variants")
        .select("*", { count: "exact", head: true })
        .eq("active", true)
        .lte("stock_quantity", LOW_STOCK_THRESHOLD),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(8),
    ]);

  const revenue = (paidOrders ?? []).reduce((sum, o) => sum + Number(o.total), 0);

  return {
    totalOrders: totalOrders ?? 0,
    revenue,
    totalProducts: totalProducts ?? 0,
    lowStockCount: lowStockCount ?? 0,
    recentOrders: (recentOrders ?? []) as Order[],
  };
}

export async function listAllProductsForAdmin(): Promise<ProductWithRelations[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as ProductWithRelations[]).map((p) => ({
    ...p,
    images: [...p.images].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function getProductForAdmin(id: string): Promise<ProductWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*), images:product_images(*), variants:product_variants(*)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const product = data as unknown as ProductWithRelations;
  product.images = [...product.images].sort((a, b) => a.sort_order - b.sort_order);
  return product;
}

export async function listAllOrdersForAdmin(): Promise<Order[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Order[];
}

export async function listLowStockVariants() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_variants")
    .select("*, product:products(name, slug)")
    .eq("active", true)
    .lte("stock_quantity", LOW_STOCK_THRESHOLD)
    .order("stock_quantity", { ascending: true });
  return data ?? [];
}
