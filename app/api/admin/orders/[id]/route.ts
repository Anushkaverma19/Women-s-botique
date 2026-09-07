import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderStatusUpdateSchema } from "@/lib/validations/schemas";
import { handleApiError } from "@/lib/api-response";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = orderStatusUpdateSchema.parse({ orderId: id, ...(await request.json()) });
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("orders")
      .update({ status: body.status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ order: data });
  } catch (error) {
    return handleApiError(error);
  }
}
