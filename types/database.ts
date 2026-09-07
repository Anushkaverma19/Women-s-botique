// Core domain types mirroring the Supabase schema in supabase/migrations.
// Kept hand-written (rather than generated) so the project builds without
// requiring a live Supabase connection during development.

export type UserRole = "customer" | "admin";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  base_price: number;
  compare_at_price: number | null;
  material: string;
  care: string;
  color_family: string;
  occasion_tags: string[];
  featured: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string;
  sort_order: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  color: string;
  size: string;
  sku: string;
  price: number;
  stock_quantity: number;
  active: boolean;
}

export interface ProductWithRelations extends Product {
  category: Category | null;
  images: ProductImage[];
  variants: ProductVariant[];
}

export type DiscountType = "percentage" | "fixed";

export interface Coupon {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  minimum_order_amount: number;
  max_discount: number | null;
  active: boolean;
  expires_at: string | null;
}

export interface Cart {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  variant_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface CartItemWithDetails extends CartItem {
  variant: ProductVariant;
  product: Pick<Product, "id" | "name" | "slug" | "base_price">;
  image: string | null;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  coupon_code: string | null;
  payment_status: PaymentStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  shipping_country: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url: string | null;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

export const OCCASIONS = [
  "wedding",
  "festive",
  "evening",
  "formal",
  "gift",
  "everyday-luxury",
] as const;

export type Occasion = (typeof OCCASIONS)[number];
