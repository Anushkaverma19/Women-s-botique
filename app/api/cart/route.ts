import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { getCartSummary } from "@/lib/cart/queries";
import { handleApiError } from "@/lib/api-response";

export async function GET() {
  try {
    const profile = await requireUser();
    const summary = await getCartSummary(profile.id);
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
