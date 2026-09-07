import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { couponValidateSchema } from "@/lib/validations/schemas";
import { validateCoupon } from "@/lib/coupons/validate";
import { handleApiError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = couponValidateSchema.parse(await request.json());
    const result = await validateCoupon(body.code, body.subtotal);
    return NextResponse.json(result, { status: result.valid ? 200 : 400 });
  } catch (error) {
    return handleApiError(error);
  }
}
