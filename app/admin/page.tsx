import Link from "next/link";
import { getDashboardStats } from "@/lib/admin/queries";
import { formatINR, formatDate } from "@/lib/utils";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-8">Dashboard</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total Orders" value={String(stats.totalOrders)} />
        <StatCard label="Revenue" value={formatINR(stats.revenue)} />
        <StatCard label="Active Products" value={String(stats.totalProducts)} />
        <StatCard
          label="Low-Stock SKUs"
          value={String(stats.lowStockCount)}
          accent={stats.lowStockCount > 0}
        />
      </div>

      <div className="bg-white rounded border border-black/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10">
          <h2 className="text-sm font-medium">Recent Orders</h2>
          <Link href="/admin/orders" className="text-xs text-black/50 hover:text-black">
            View all
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/40 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Order</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Payment</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentOrders.map((order) => (
              <tr key={order.id} className="border-t border-black/5 hover:bg-black/[0.02]">
                <td className="px-5 py-3">
                  <Link href={`/admin/orders`} className="text-black hover:underline">
                    {order.order_number}
                  </Link>
                </td>
                <td className="px-5 py-3 text-black/60">{formatDate(order.created_at)}</td>
                <td className="px-5 py-3">{formatINR(order.total)}</td>
                <td className="px-5 py-3 capitalize">{order.payment_status}</td>
                <td className="px-5 py-3 capitalize">{order.status}</td>
              </tr>
            ))}
            {stats.recentOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-black/40">
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

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white rounded border border-black/10 px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-black/40 mb-2">{label}</p>
      <p className={`text-2xl font-semibold ${accent ? "text-burgundy" : ""}`}>{value}</p>
    </div>
  );
}
