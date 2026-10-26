"use client";

import { useState } from "react";
import { Container } from "@/components/ui/primitives";
import { Button, LinkButton } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck, AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on?: (event: string, callback: (response: unknown) => void) => void;
    };
  }
}

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function TestPaymentPage() {
  const [amount, setAmount] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    orderId: string;
    paymentId: string;
    signature: string;
    verified: boolean;
  } | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setStatus("Loading Razorpay Checkout script...");
    setError(null);
    setVerificationResult(null);

    try {
      // 1. Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Failed to load Razorpay checkout script from https://checkout.razorpay.com/v1/checkout.js");
      }

      // 2. Call Backend API Route to create order using Razorpay Node SDK
      setStatus("Creating Razorpay Order via Backend API...");
      const orderRes = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: "INR",
          receipt: `rcpt_test_${Date.now()}`,
          notes: { test_flow: "true", client: "Mehrae Test Payment" },
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.ok) {
        throw new Error(orderData.error || "Failed to create order on server.");
      }

      setStatus("Opening Razorpay Payment Modal...");

      // 3. Configure Razorpay modal with Dummy Success Handler
      const options = {
        key: orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TsEIr4nFTX8m4j",
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        order_id: orderData.orderId,
        name: "MEHRAÉ BOUTIQUE",
        description: `Test Mode Payment (₹${amount})`,
        image: "https://mehrae.com/logo.png",
        prefill: {
          name: "Test Customer",
          email: "customer@mehrae.com",
          contact: "9876543210",
        },
        theme: {
          color: "#800020", // Mehrae Burgundy
        },
        // 4. Dummy Success Handler to verify payment response and test the transaction flow
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          console.log("[Razorpay Dummy Success Handler] Payment response received:", response);
          setStatus("Verifying payment signature with backend...");

          try {
            // Verify payment response via backend verification route
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            console.log("[Razorpay Verification Result]:", verifyData);

            if (verifyData.verified) {
              setVerificationResult({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                verified: true,
              });
              setStatus("Payment completed and verified successfully!");
            } else {
              setError(verifyData.error || "Signature verification failed.");
              setStatus(null);
            }
          } catch (verifyErr: unknown) {
            console.error("Verification error:", verifyErr);
            const msg = verifyErr instanceof Error ? verifyErr.message : "Failed to verify payment with backend.";
            setError(msg);
            setStatus(null);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            setStatus(null);
            setError("Payment was cancelled or modal closed by user.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      if (rzp.on) {
        rzp.on("payment.failed", function (response: unknown) {
          console.warn("[Razorpay Payment Failed]:", response);
          const failedPayload = response as { error?: { description?: string } } | undefined;
          setError(failedPayload?.error?.description || "Payment failed at gateway.");
          setLoading(false);
          setStatus(null);
        });
      }

      rzp.open();
    } catch (err: unknown) {
      console.error("Payment error:", err);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
      setLoading(false);
      setStatus(null);
    }
  }

  return (
    <Container className="py-16 max-w-2xl">
      <div className="mb-8">
        <LinkButton href="/checkout" variant="ghost" className="gap-2 text-sm text-charcoal/70 mb-4 inline-flex items-center">
          <ArrowLeft size={16} /> Back to Checkout
        </LinkButton>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
            <ShieldCheck size={13} /> Razorpay Test Mode
          </span>
          <span className="text-xs text-charcoal/50">rzp_test_TsEIr4nFTX8m4j</span>
        </div>
        <h1 className="font-display text-3xl mt-3">Razorpay Integration Test Console</h1>
        <p className="text-charcoal/60 text-sm mt-1">
          Test the end-to-end checkout workflow, order creation via Node SDK, checkout script loading, modal launch, and dummy success verification.
        </p>
      </div>

      <div className="border border-charcoal/15 bg-white p-6 shadow-sm rounded-none space-y-6">
        <div>
          <label htmlFor="testAmount" className="block text-xs font-medium uppercase tracking-wider text-charcoal/70 mb-2">
            Test Order Amount (INR)
          </label>
          <div className="flex gap-3">
            {[1, 100, 500, 1999].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(val)}
                className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                  amount === val
                    ? "bg-burgundy text-white border-burgundy"
                    : "bg-parchment/50 border-charcoal/20 text-charcoal hover:bg-parchment"
                }`}
              >
                ₹{val}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-charcoal/70">Custom: ₹</span>
            <input
              id="testAmount"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
              className="border border-charcoal/25 px-3 py-1.5 text-sm w-32 focus:outline-none focus:border-burgundy"
            />
          </div>
        </div>

        <div className="bg-parchment/40 p-4 border border-charcoal/10 text-xs space-y-2">
          <p className="font-semibold text-charcoal">Security Checklist Enforced (Post-Audit):</p>
          <ul className="list-disc list-inside space-y-1 text-charcoal/80">
            <li>Session Authentication strictly required via <code className="bg-white px-1 py-0.5 border">requireUser()</code></li>
            <li>Zero client-side amount trust: order total is computed strictly from database bag</li>
            <li>Razorpay checkout script loaded from <code className="bg-white px-1 py-0.5 border">https://checkout.razorpay.com/v1/checkout.js</code></li>
            <li>Cryptographic HMAC-SHA256 signature verification and order finalization</li>
          </ul>
        </div>

        {status && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin shrink-0" />
            <span>{status}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
            {error.includes("Authentication required") && (
              <div className="pt-2">
                <LinkButton href="/login?redirectTo=/test-payment" variant="outline" className="text-xs">
                  Log in to Test Checkout
                </LinkButton>
              </div>
            )}
            {error.includes("bag is empty") && (
              <div className="pt-2">
                <LinkButton href="/shop" variant="outline" className="text-xs">
                  Add Item from Shop
                </LinkButton>
              </div>
            )}
          </div>
        )}

        {verificationResult && (
          <div className="p-5 bg-emerald-50 border border-emerald-200 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-medium text-sm">
              <CheckCircle2 size={18} />
              <span>Dummy Success Handler: Payment Verified Successfully!</span>
            </div>
            <div className="text-xs space-y-1.5 font-mono text-emerald-950 bg-white/70 p-3 border border-emerald-200/60 rounded">
              <div><span className="font-sans font-semibold text-charcoal/60">Razorpay Order ID:</span> {verificationResult.orderId}</div>
              <div><span className="font-sans font-semibold text-charcoal/60">Razorpay Payment ID:</span> {verificationResult.paymentId}</div>
              <div className="truncate"><span className="font-sans font-semibold text-charcoal/60">Signature (HMAC-SHA256):</span> {verificationResult.signature}</div>
              <div><span className="font-sans font-semibold text-charcoal/60">Status:</span> <span className="text-emerald-700 font-bold uppercase">PAID & VERIFIED</span></div>
            </div>
          </div>
        )}

        <Button
          id="checkout-btn"
          type="button"
          disabled={loading}
          onClick={handleCheckout}
          className="w-full py-3 text-sm tracking-widest uppercase"
        >
          {loading ? "Processing..." : "Launch Razorpay Checkout"}
        </Button>
      </div>
    </Container>
  );
}
