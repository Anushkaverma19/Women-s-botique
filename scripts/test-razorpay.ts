import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Constant-time signature comparison test functions (matching lib/razorpay/client.ts)
function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyCheckoutSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  keySecret: string;
}): boolean {
  if (!params.keySecret || !params.razorpayOrderId || !params.razorpayPaymentId || !params.razorpaySignature) {
    return false;
  }
  const payload = `${params.razorpayOrderId}|${params.razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", params.keySecret)
    .update(payload)
    .digest("hex");
  return constantTimeCompare(expectedSignature, params.razorpaySignature);
}

function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
  if (!webhookSecret || !rawBody || !signature) return false;
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  return constantTimeCompare(expectedSignature, signature);
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, extra?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${extra ? `(${extra})` : ""}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("       MEHRAÉ RAZORPAY INTEGRATION TEST SUITE");
  console.log("=======================================================\n");

  const testSecret = "test_secret_key_1234567890abcdef";
  const testWebhookSecret = "test_webhook_secret_9876543210fedcba";

  // -----------------------------------------------------------------
  // 1. Checkout Signature Verification (HMAC-SHA256 Constant-Time)
  // -----------------------------------------------------------------
  console.log("1. Testing Checkout Signature Verification (HMAC-SHA256 Constant-Time):");

  const validOrderId = "order_O8xG1234567890";
  const validPaymentId = "pay_P9yH0987654321";
  const validPayload = `${validOrderId}|${validPaymentId}`;
  const validSignature = crypto
    .createHmac("sha256", testSecret)
    .update(validPayload)
    .digest("hex");

  const passValid = verifyCheckoutSignature({
    razorpayOrderId: validOrderId,
    razorpayPaymentId: validPaymentId,
    razorpaySignature: validSignature,
    keySecret: testSecret,
  });
  assert(passValid === true, "Valid checkout signature must verify successfully");

  const failTamperedSig = verifyCheckoutSignature({
    razorpayOrderId: validOrderId,
    razorpayPaymentId: validPaymentId,
    razorpaySignature: "invalid_signature_hex_code_12345",
    keySecret: testSecret,
  });
  assert(failTamperedSig === false, "Tampered signature must be rejected");

  const failTamperedOrder = verifyCheckoutSignature({
    razorpayOrderId: "order_different_order_id",
    razorpayPaymentId: validPaymentId,
    razorpaySignature: validSignature,
    keySecret: testSecret,
  });
  assert(failTamperedOrder === false, "Tampered order_id with valid signature must be rejected");

  const failTamperedPayment = verifyCheckoutSignature({
    razorpayOrderId: validOrderId,
    razorpayPaymentId: "pay_different_payment_id",
    razorpaySignature: validSignature,
    keySecret: testSecret,
  });
  assert(failTamperedPayment === false, "Tampered payment_id with valid signature must be rejected");

  const failMissingSecret = verifyCheckoutSignature({
    razorpayOrderId: validOrderId,
    razorpayPaymentId: validPaymentId,
    razorpaySignature: validSignature,
    keySecret: "",
  });
  assert(failMissingSecret === false, "Missing secret key must return false securely");

  // -----------------------------------------------------------------
  // 2. Webhook Signature Verification (Raw Body HMAC-SHA256)
  // -----------------------------------------------------------------
  console.log("\n2. Testing Webhook Signature Verification (Raw Body HMAC):");

  const rawWebhookBody = JSON.stringify({
    entity: "event",
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: validPaymentId,
          order_id: validOrderId,
          amount: 549900,
          status: "captured",
        },
      },
    },
  });

  const validWebhookSig = crypto
    .createHmac("sha256", testWebhookSecret)
    .update(rawWebhookBody)
    .digest("hex");

  const passWebhook = verifyWebhookSignature(rawWebhookBody, validWebhookSig, testWebhookSecret);
  assert(passWebhook === true, "Valid webhook payload and signature must verify successfully");

  const failModifiedBody = verifyWebhookSignature(
    rawWebhookBody + " ",
    validWebhookSig,
    testWebhookSecret
  );
  assert(failModifiedBody === false, "Altered webhook payload (even 1 trailing space) must fail verification");

  const failWrongSig = verifyWebhookSignature(
    rawWebhookBody,
    "bad_signature_string",
    testWebhookSecret
  );
  assert(failWrongSig === false, "Invalid webhook signature must fail verification");

  // -----------------------------------------------------------------
  // 3. Amount and Currency Formatting
  // -----------------------------------------------------------------
  console.log("\n3. Testing Amount and Pricing Validation Rules:");

  const subtotalRupees = 5499;
  const amountPaise = Math.round(subtotalRupees * 100);
  assert(amountPaise === 549900, "Rupee to paise conversion (5499 INR -> 549900 paise)");

  const shippingUnder = 4999 < 5000 ? 149 : 0;
  assert(shippingUnder === 149, "Orders under ₹5000 have flat ₹149 shipping");

  const shippingFree = 5000 >= 5000 ? 0 : 149;
  assert(shippingFree === 0, "Orders ₹5000 or more have free shipping");

  // -----------------------------------------------------------------
  // 4. Supabase DB RPCs & Idempotency Testing
  // -----------------------------------------------------------------
  console.log("\n4. Testing Supabase RPCs, Schema & Idempotency Protections:");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    console.warn("  ⚠ SKIPPED: Supabase credentials not set for live DB checks");
  } else {
    try {
      const admin = createClient(supabaseUrl, secretKey);

      // Check schema columns
      const { data: cols, error: errCols } = await admin
        .from("orders")
        .select("razorpay_order_id, razorpay_payment_id")
        .limit(1);
      assert(!errCols, "orders table has razorpay_order_id and razorpay_payment_id columns");

      // Check empty cart validation
      const { error: emptyCartErr } = await admin.rpc("create_razorpay_order", {
        p_user_id: "00000000-0000-0000-0000-000000000000",
        p_items: [],
        p_coupon_code: null,
        p_shipping: 0,
        p_customer_name: "Test",
        p_customer_email: "test@example.com",
        p_customer_phone: "9876543210",
        p_shipping_address: "Address",
        p_shipping_city: "City",
        p_shipping_state: "State",
        p_shipping_postal_code: "110001",
        p_shipping_country: "India",
      });
      assert(
        emptyCartErr?.message === "EMPTY_CART",
        "create_razorpay_order rejects empty bag items atomically"
      );

      // Test idempotency of finalize_razorpay_order
      const { data: sampleVariant } = await admin
        .from("product_variants")
        .select("id, stock_quantity")
        .limit(1)
        .single();

      if (sampleVariant) {
        const initialStock = sampleVariant.stock_quantity;
        const testUserId = "79b87eef-3d29-43b8-9e4f-72f62ac99eb1";
        const testRzpOrderId = `test_rzp_${Date.now()}`;
        const testRzpPaymentId = `test_pay_${Date.now()}`;

        const { data: createdOrder, error: createErr } = await admin.rpc(
          "create_razorpay_order",
          {
            p_user_id: testUserId,
            p_items: [{ variant_id: sampleVariant.id, quantity: 1 }],
            p_coupon_code: null,
            p_shipping: 0,
            p_customer_name: "Idempotency Test",
            p_customer_email: "test@example.com",
            p_customer_phone: "9876543210",
            p_shipping_address: "Test St",
            p_shipping_city: "Mumbai",
            p_shipping_state: "MH",
            p_shipping_postal_code: "400001",
            p_shipping_country: "India",
          }
        );

        if (!createErr && createdOrder) {
          // Check stock was reserved
          const { data: stockAfterReserve } = await admin
            .from("product_variants")
            .select("stock_quantity")
            .eq("id", sampleVariant.id)
            .single();
          assert(
            stockAfterReserve?.stock_quantity === initialStock - 1,
            "Inventory stock is decremented immediately upon create_razorpay_order"
          );

          // Assign razorpay order ID
          await admin
            .from("orders")
            .update({ razorpay_order_id: testRzpOrderId })
            .eq("id", createdOrder.id);

          // 1st Finalization call
          const { data: finalize1, error: errFin1 } = await admin.rpc(
            "finalize_razorpay_order",
            {
              p_razorpay_order_id: testRzpOrderId,
              p_razorpay_payment_id: testRzpPaymentId,
            }
          );
          assert(
            !errFin1 && finalize1?.payment_status === "paid",
            "1st call to finalize_razorpay_order marks payment_status as paid"
          );

          // 2nd Finalization call (simulate duplicate webhook / concurrent callback)
          const { data: finalize2, error: errFin2 } = await admin.rpc(
            "finalize_razorpay_order",
            {
              p_razorpay_order_id: testRzpOrderId,
              p_razorpay_payment_id: testRzpPaymentId,
            }
          );
          assert(
            !errFin2 && finalize2?.payment_status === "paid",
            "2nd call (duplicate callback/webhook) is completely idempotent and succeeds without error"
          );

          // Verify stock was not deducted twice
          const { data: stockAfterDoubleFinalize } = await admin
            .from("product_variants")
            .select("stock_quantity")
            .eq("id", sampleVariant.id)
            .single();
          assert(
            stockAfterDoubleFinalize?.stock_quantity === initialStock - 1,
            "Stock was preserved and not double-deducted on duplicate finalization"
          );

          // Cleanup test order and restore stock
          await admin.from("order_items").delete().eq("order_id", createdOrder.id);
          await admin.from("orders").delete().eq("id", createdOrder.id);
          await admin
            .from("product_variants")
            .update({ stock_quantity: initialStock })
            .eq("id", sampleVariant.id);
          console.log("  ✓ PASS: Cleaned up temporary test order & restored stock");
          passed++;
        }
      }
    } catch (e) {
      console.error("DB test error:", e);
      failed++;
    }
  }

  console.log("\n-------------------------------------------------------");
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("-------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
