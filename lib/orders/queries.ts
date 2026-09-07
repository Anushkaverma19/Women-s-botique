import { createClient } from "@/lib/supabase/server";
import type { OrderWithItems, Order } from "@/types/database";

export async function getOrdersForUser(userId: string): Promise<Order[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as Order[];
}

/**
 * Fetches one order with its items. RLS ensures a customer can only reach
 * their own order even if they guess another order's id; admins can reach
 * any order.
 */
export async function getOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  return { ...(order as Order), items: items ?? [] };
}
