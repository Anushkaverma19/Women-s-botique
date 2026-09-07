import Link from "next/link";
import { Container, EmptyState } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { getSessionUser } from "@/lib/supabase/auth";
import { getOrdersForUser } from "@/lib/orders/queries";
import { formatINR, formatDate } from "@/lib/utils";

export const metadata = { title: "Your Orders" };

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function OrdersPage() {
  const user = await getSessionUser();
  const orders = user ? await getOrdersForUser(user.id) : [];

  return (
    <Container className="py-12 max-w-4xl">
      <h1 className="font-display text-4xl mb-10">Your Orders</h1>
      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet."
          description="Once you place an order, it will appear here."
          action={<LinkButton href="/shop">Explore the Collection</LinkButton>}
        />
      ) : (
        <ul className="divide-y divide-charcoal/10">
          {orders.map((order) => (
            <li key={order.id} className="py-6">
              <Link href={`/orders/${order.id}`} className="flex flex-wrap items-center justify-between gap-3 group">
                <div>
                  <p className="font-display text-xl group-hover:text-burgundy">{order.order_number}</p>
                  <p className="text-xs text-charcoal/50 mt-1">{formatDate(order.created_at)}</p>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-xs eyebrow border border-charcoal/20 px-3 py-1.5">
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                  <span className="text-sm">{formatINR(order.total)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
