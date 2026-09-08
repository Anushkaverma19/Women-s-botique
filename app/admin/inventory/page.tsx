import Link from "next/link";
import { listLowStockVariants } from "@/lib/admin/queries";

export const metadata = { title: "Admin - Inventory" };

interface LowStockRow {
  id: string;
  sku: string;
  color: string;
  size: string;
  stock_quantity: number;
  product: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
}

export default async function AdminInventoryPage() {
  const variants = (await listLowStockVariants()) as unknown as LowStockRow[];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Inventory</h1>
      <p className="text-sm text-black/50 mb-8">SKUs at 3 units or fewer, sorted by lowest stock first.</p>

      <div className="bg-white rounded border border-black/10 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-black/40 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Product</th>
              <th className="px-5 py-3 font-medium">SKU</th>
              <th className="px-5 py-3 font-medium">Color / Size</th>
              <th className="px-5 py-3 font-medium">Stock</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => {
              const product = Array.isArray(variant.product) ? variant.product[0] : variant.product;
              return (
                <tr key={variant.id} className="border-t border-black/5">
                  <td className="px-5 py-3">{product?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-black/50">{variant.sku}</td>
                  <td className="px-5 py-3">
                    {variant.color} / {variant.size}
                  </td>
                  <td className="px-5 py-3">
                    <span className={variant.stock_quantity === 0 ? "text-burgundy font-medium" : "text-black"}>
                      {variant.stock_quantity}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {product ? (
                      <Link href={`/admin/products/${product.id}`} className="text-xs text-black/50 hover:text-black">
                        Manage
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {variants.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-black/40">
                  No low-stock SKUs right now.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
