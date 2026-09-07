import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { getOrderWithItems } from "@/lib/orders/queries";
import { formatINR, formatDate } from "@/lib/utils";

export const metadata = { title: "Order Confirmed" };

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  if (!orderId) notFound();

  const order = await getOrderWithItems(orderId);
  if (!order) notFound();

  return (
    <Container className="py-20 max-w-2xl text-center">
      <CheckCircle2 className="mx-auto text-emerald mb-6" size={48} />
      <h1 className="font-display text-4xl mb-3">Thank you, {order.customer_name.split(" ")[0]}.</h1>
      <p className="text-charcoal/60 mb-8">
        Your order <span className="text-charcoal">{order.order_number}</span> has been confirmed and is being
        prepared with care.
      </p>

      <div className="border border-charcoal/15 text-left p-6 mb-10">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-charcoal/60">Order Date</span>
          <span>{formatDate(order.created_at)}</span>
        </div>
        <div className="flex justify-between text-sm mb-4">
          <span className="text-charcoal/60">Payment Status</span>
          <span className="capitalize">{order.payment_status}</span>
        </div>
        <ul className="hairline border-t pt-4 space-y-2 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>
                {item.product_name} ({item.color} / {item.size}) × {item.quantity}
              </span>
              <span>{formatINR(item.total_price)}</span>
            </li>
          ))}
        </ul>
        <div className="hairline border-t mt-4 pt-4 flex justify-between font-medium">
          <span>Total</span>
          <span>{formatINR(order.total)}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <LinkButton href={`/orders/${order.id}`} variant="outline">
          View Order
        </LinkButton>
        <LinkButton href="/shop">Continue Shopping</LinkButton>
      </div>
    </Container>
  );
}
