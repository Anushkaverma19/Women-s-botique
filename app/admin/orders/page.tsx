import { listAllOrdersForAdmin } from "@/lib/admin/queries";
import { formatINR, formatDate } from "@/lib/utils";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";

export const metadata = { title: "Admin - Orders" };

export default async function AdminOrdersPage() {
  const orders = await listAllOrdersForAdmin();

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-8">Orders</h1>
      <div className="bg-white rounded border border-black/10 overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-left text-black/40 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Order</th>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Payment</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-black/5">
                <td className="px-5 py-3">{order.order_number}</td>
                <td className="px-5 py-3 text-black/60">
                  <div>{order.customer_name}</div>
                  <div className="text-xs text-black/40">{order.customer_email}</div>
                </td>
                <td className="px-5 py-3 text-black/60">{formatDate(order.created_at)}</td>
                <td className="px-5 py-3">{formatINR(order.total)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      order.payment_status === "paid"
                        ? "bg-emerald/10 text-emerald"
                        : order.payment_status === "failed"
                          ? "bg-burgundy/10 text-burgundy"
                          : "bg-black/5 text-black/40"
                    }`}
                  >
                    {order.payment_status}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <OrderStatusSelect orderId={order.id} status={order.status} />
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-black/40">
                  No orders yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
