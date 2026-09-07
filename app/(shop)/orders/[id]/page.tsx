import { notFound } from "next/navigation";
import { Container } from "@/components/ui/primitives";
import { getOrderWithItems } from "@/lib/orders/queries";
import { formatINR, formatDate } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderWithItems(id);
  if (!order) notFound();

  return (
    <Container className="py-12 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="font-display text-4xl">{order.order_number}</h1>
          <p className="text-sm text-charcoal/50 mt-1">Placed on {formatDate(order.created_at)}</p>
        </div>
        <span className="eyebrow border border-charcoal/20 px-4 py-2">
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-8 mb-10 text-sm">
        <div>
          <p className="eyebrow text-charcoal/50 mb-2">Shipping To</p>
          <p>{order.customer_name}</p>
          <p>{order.shipping_address}</p>
          <p>
            {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}
          </p>
          <p>{order.shipping_country}</p>
        </div>
        <div>
          <p className="eyebrow text-charcoal/50 mb-2">Payment</p>
          <p className="capitalize">{order.payment_status}</p>
          {order.coupon_code ? <p className="text-charcoal/60 mt-1">Coupon: {order.coupon_code}</p> : null}
        </div>
      </div>

      <ul className="divide-y divide-charcoal/10 mb-8">
        {order.items.map((item) => (
          <li key={item.id} className="py-4 flex justify-between text-sm">
            <div>
              <p className="font-display text-lg">{item.product_name}</p>
              <p className="text-xs text-charcoal/50 mt-1">
                {item.color} · {item.size} · SKU {item.sku} · Qty {item.quantity}
              </p>
            </div>
            <p>{formatINR(item.total_price)}</p>
          </li>
        ))}
      </ul>

      <div className="border-t border-charcoal/15 pt-4 space-y-2 text-sm max-w-xs ml-auto">
        <div className="flex justify-between">
          <span className="text-charcoal/60">Subtotal</span>
          <span>{formatINR(order.subtotal)}</span>
        </div>
        {order.discount > 0 ? (
          <div className="flex justify-between text-emerald">
            <span>Discount</span>
            <span>-{formatINR(order.discount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span className="text-charcoal/60">Shipping</span>
          <span>{order.shipping === 0 ? "Free" : formatINR(order.shipping)}</span>
        </div>
        <div className="flex justify-between font-medium text-base border-t border-charcoal/15 pt-2">
          <span>Total</span>
          <span>{formatINR(order.total)}</span>
        </div>
      </div>
    </Container>
  );
}
