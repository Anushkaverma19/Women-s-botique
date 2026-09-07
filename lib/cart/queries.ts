import { createClient } from "@/lib/supabase/server";
import type { CartItemWithDetails } from "@/types/database";

export interface CartSummary {
  items: CartItemWithDetails[];
  subtotal: number;
  itemCount: number;
}

/**
 * Returns the current user's cart id, creating one if it doesn't exist yet.
 * Must be called with an authenticated Supabase server client - RLS ensures
 * a user can only ever get/create their own cart row.
 */
export async function getOrCreateCartId(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error("Could not create a shopping bag for this account.");
  }

  return created.id;
}

export async function getCartSummary(userId: string): Promise<CartSummary> {
  const supabase = await createClient();
  const cartId = await getOrCreateCartId(userId);

  const { data, error } = await supabase
    .from("cart_items")
    .select(
      `id, cart_id, variant_id, quantity, created_at, updated_at,
       variant:product_variants(*, product:products(id, name, slug, base_price, active,
         images:product_images(image_url, sort_order)))`
    )
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return { items: [], subtotal: 0, itemCount: 0 };
  }

  // Supabase returns nested relations typed loosely - normalize defensively
  // rather than trusting the shape blindly.
  type RawRow = {
    id: string;
    cart_id: string;
    variant_id: string;
    quantity: number;
    created_at: string;
    updated_at: string;
    variant: {
      id: string;
      product_id: string;
      color: string;
      size: string;
      sku: string;
      price: number;
      stock_quantity: number;
      active: boolean;
      product: {
        id: string;
        name: string;
        slug: string;
        base_price: number;
        active: boolean;
        images: { image_url: string; sort_order: number }[];
      } | null;
    } | null;
  };

  const rows = data as unknown as RawRow[];

  const items: CartItemWithDetails[] = rows
    .filter((row) => row.variant && row.variant.product && row.variant.product.active)
    .map((row) => {
      const variant = row.variant!;
      const product = variant.product!;
      const sortedImages = [...product.images].sort((a, b) => a.sort_order - b.sort_order);
      return {
        id: row.id,
        cart_id: row.cart_id,
        variant_id: row.variant_id,
        quantity: row.quantity,
        created_at: row.created_at,
        updated_at: row.updated_at,
        variant: {
          id: variant.id,
          product_id: variant.product_id,
          color: variant.color,
          size: variant.size,
          sku: variant.sku,
          price: variant.price,
          stock_quantity: variant.stock_quantity,
          active: variant.active,
        },
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          base_price: product.base_price,
        },
        image: sortedImages[0]?.image_url ?? null,
      };
    });

  const subtotal = items.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return { items, subtotal, itemCount };
}
