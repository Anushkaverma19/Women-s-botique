import Link from "next/link";
import Image from "next/image";
import { listAllProductsForAdmin } from "@/lib/admin/queries";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Admin - Products" };

export default async function AdminProductsPage() {
  const products = await listAllProductsForAdmin();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link
          href="/admin/products/new"
          className="text-sm bg-[#1a1a1a] text-white px-4 py-2.5 rounded hover:opacity-90"
        >
          + New Product
        </Link>
      </div>

      <div className="bg-white rounded border border-black/10 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-black/40 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Product</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Price</th>
              <th className="px-5 py-3 font-medium">Variants</th>
              <th className="px-5 py-3 font-medium">Stock</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const totalStock = product.variants.reduce((sum, v) => sum + v.stock_quantity, 0);
              return (
                <tr key={product.id} className="border-t border-black/5 hover:bg-black/[0.02]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-9 bg-black/5 shrink-0">
                        {product.images[0] ? (
                          <Image
                            src={product.images[0].image_url}
                            alt=""
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <span>{product.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-black/60">{product.category?.name ?? "—"}</td>
                  <td className="px-5 py-3">{formatINR(product.base_price)}</td>
                  <td className="px-5 py-3">{product.variants.length}</td>
                  <td className="px-5 py-3">{totalStock}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        product.active ? "bg-emerald/10 text-emerald" : "bg-black/5 text-black/40"
                      }`}
                    >
                      {product.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/products/${product.id}`} className="text-black/60 hover:text-black text-xs">
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-black/40">
                  No products yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
