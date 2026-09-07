import { notFound } from "next/navigation";
import { getCategories } from "@/lib/products/queries";
import { getProductForAdmin } from "@/lib/admin/queries";
import { ProductForm } from "@/components/admin/ProductForm";
import { VariantManager } from "@/components/admin/VariantManager";

export const metadata = { title: "Admin - Edit Product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [categories, product] = await Promise.all([getCategories(), getProductForAdmin(id)]);

  if (!product) notFound();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold mb-8">Edit Product</h1>
        <ProductForm categories={categories} product={product} />
      </div>
      <VariantManager productId={product.id} variants={product.variants} />
    </div>
  );
}
