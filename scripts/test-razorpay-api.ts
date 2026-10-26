import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

console.log("Checking Razorpay credentials:");
console.log("- Key ID:", keyId ? `${keyId.slice(0, 10)}...` : "MISSING");
console.log("- Key Secret:", keySecret ? `${keySecret.slice(0, 5)}...` : "MISSING");

if (!keyId || !keySecret) {
  console.error("Missing Razorpay keys in environment.");
  process.exit(1);
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

async function testCreateOrder() {
  try {
    console.log("Attempting to create a test order of ₹500 (50000 paise)...");
    const order = await razorpay.orders.create({
      amount: 50000,
      currency: "INR",
      receipt: `test_rcpt_${Date.now()}`,
      notes: {
        test: "Razorpay Test Mode Integration Verification",
      },
    });

    console.log("✓ Razorpay Order Created Successfully!");
    console.log("  Order ID:", order.id);
    console.log("  Amount:", order.amount, order.currency);
    console.log("  Status:", order.status);
    console.log("Razorpay test credentials are 100% VALID and ACTIVE.");
  } catch (error: unknown) {
    console.error("✗ Failed to create Razorpay order:", error);
    process.exit(1);
  }
}

testCreateOrder();
