import { createClient } from "@/lib/supabase/server";

export interface CouponValidationResult {
  valid: boolean;
  code?: string;
  discountAmount?: number;
  error?: "INVALID_COUPON" | "COUPON_EXPIRED" | "MINIMUM_NOT_MET" | "UNKNOWN";
  message?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_COUPON: "That coupon code isn't valid.",
  COUPON_EXPIRED: "That coupon has expired.",
  MINIMUM_NOT_MET: "Your bag doesn't meet the minimum order amount for this coupon.",
};

/**
 * Validates a coupon entirely server-side via the `validate_coupon` Postgres
 * function. The discount amount returned here is authoritative - the
 * checkout flow never trusts a client-calculated discount.
 */
export async function validateCoupon(
  code: string,
  subtotal: number
): Promise<CouponValidationResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_coupon", {
    p_code: code,
    p_subtotal: subtotal,
  });

  if (error) {
    const key = (error.message || "").split(":")[0].trim();
    return {
      valid: false,
      error: (key as CouponValidationResult["error"]) ?? "UNKNOWN",
      message: ERROR_MESSAGES[key] ?? "This coupon could not be applied.",
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { valid: false, error: "UNKNOWN", message: "This coupon could not be applied." };
  }

  return {
    valid: true,
    code: row.code,
    discountAmount: Number(row.discount_amount),
  };
}
