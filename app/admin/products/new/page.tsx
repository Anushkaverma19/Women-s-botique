import { getCategories } from "@/lib/products/queries";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata = { title: "Admin - New Product" };

export default async function NewProductPage() {
  const categories = await getCategories();
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-8">New Product</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
