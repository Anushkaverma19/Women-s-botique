import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderWithItems } from "@/lib/orders/queries";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { formatINR, formatDate } from "@/lib/utils";

export const metadata = { title: "Admin - Order Detail" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Admin RLS policy ("orders_owner_or_admin_select") allows any order to
  // be read here since the caller has already been verified as admin by
  // the /admin layout and middleware - this reuses the same customer-facing
  // query, which is safe because RLS (not this query) is what decides
  // visibility, and it already grants admins unrestricted read access.
  const order = await getOrderWithItems(id);
  if (!order) notFound();

  return (
    <div>
      <Link href="/admin/orders" className="text-xs text-black/50 hover:text-black">
        ← Back to Orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 mt-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold">{order.order_number}</h1>
          <p className="text-sm text-black/50 mt-1">Placed on {formatDate(order.created_at)}</p>
        </div>
        <OrderStatusSelect orderId={order.id} status={order.status} />
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-black/10 rounded p-5">
          <p className="text-xs uppercase tracking-wide text-black/40 mb-2">Customer</p>
          <p className="text-sm">{order.customer_name}</p>
          <p className="text-sm text-black/60">{order.customer_email}</p>
          <p className="text-sm text-black/60">{order.customer_phone}</p>
        </div>
        <div className="bg-white border border-black/10 rounded p-5">
          <p className="text-xs uppercase tracking-wide text-black/40 mb-2">Shipping Address</p>
          <p className="text-sm">{order.shipping_address}</p>
          <p className="text-sm text-black/60">
            {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}
          </p>
          <p className="text-sm text-black/60">{order.shipping_country}</p>
        </div>
        <div className="bg-white border border-black/10 rounded p-5">
          <p className="text-xs uppercase tracking-wide text-black/40 mb-2">Payment</p>
          <p className="text-sm capitalize">{order.payment_status}</p>
          {order.coupon_code ? <p className="text-sm text-black/60 mt-1">Coupon: {order.coupon_code}</p> : null}
        </div>
      </div>

      <div className="bg-white border border-black/10 rounded overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/40 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Item</th>
              <th className="px-5 py-3 font-medium">SKU</th>
              <th className="px-5 py-3 font-medium">Qty</th>
              <th className="px-5 py-3 font-medium">Unit Price</th>
              <th className="px-5 py-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-t border-black/5">
                <td className="px-5 py-3">
                  <div>{item.product_name}</div>
                  <div className="text-xs text-black/40">
                    {item.color} / {item.size}
                  </div>
                </td>
                <td className="px-5 py-3 text-black/50">{item.sku}</td>
                <td className="px-5 py-3">{item.quantity}</td>
                <td className="px-5 py-3">{formatINR(item.unit_price)}</td>
                <td className="px-5 py-3">{formatINR(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="max-w-xs ml-auto bg-white border border-black/10 rounded p-5 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-black/50">Subtotal</span>
          <span>{formatINR(order.subtotal)}</span>
        </div>
        {order.discount > 0 ? (
          <div className="flex justify-between text-emerald">
            <span>Discount</span>
            <span>-{formatINR(order.discount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span className="text-black/50">Shipping</span>
          <span>{order.shipping === 0 ? "Free" : formatINR(order.shipping)}</span>
        </div>
        <div className="flex justify-between font-medium border-t border-black/10 pt-2">
          <span>Total</span>
          <span>{formatINR(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
