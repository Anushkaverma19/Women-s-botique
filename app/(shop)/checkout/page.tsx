"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartContext";
import { Container, EmptyState } from "@/components/ui/primitives";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/field";
import { formatINR } from "@/lib/utils";
import { checkoutSchema } from "@/lib/validations/schemas";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/app/actions/razorpay";

const FREE_SHIPPING_THRESHOLD = 5000;
const FLAT_SHIPPING = 149;

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on?: (event: string, callback: (response: unknown) => void) => void;
    };
  }
}

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Loads Razorpay's Checkout script once and reuses it on later opens. */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
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

type FormState = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
};

const initialForm: FormState = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  shippingAddress: "",
  shippingCity: "",
  shippingState: "",
  shippingPostalCode: "",
  shippingCountry: "India",
};

export default function CheckoutPage() {
  const { items, subtotal, refresh } = useCart();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(initialForm);
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const discount = couponApplied?.discountAmount ?? 0;
  const total = Math.max(0, subtotal - discount + shipping);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function applyCoupon() {
    setCouponError(null);
    setCouponLoading(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput, subtotal }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setCouponError(data.message ?? "This coupon could not be applied.");
        setCouponApplied(null);
        return;
      }
      setCouponApplied({ code: data.code, discountAmount: data.discountAmount });
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});

    // checkoutSchema still requires paymentOutcome (the demo field); reuse
    // it for shape/field validation only, with a fixed placeholder value -
    // Razorpay doesn't take a client-declared outcome at all.
    const parsed = checkoutSchema.safeParse({
      ...form,
      couponCode: couponApplied?.code ?? "",
      paymentOutcome: "success",
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const orderInput = {
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail,
        customerPhone: parsed.data.customerPhone,
        shippingAddress: parsed.data.shippingAddress,
        shippingCity: parsed.data.shippingCity,
        shippingState: parsed.data.shippingState,
        shippingPostalCode: parsed.data.shippingPostalCode,
        shippingCountry: parsed.data.shippingCountry,
        couponCode: parsed.data.couponCode,
      };
      const result = await createRazorpayOrder(orderInput);

      if (!result.ok || !result.razorpayOrderId || !result.keyId) {
        setSubmitError(result.error ?? "We couldn't start the payment. Please try again.");
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        setSubmitError("We couldn't load the payment gateway. Check your connection and try again.");
        return;
      }

      const razorpay = new window.Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency,
        order_id: result.razorpayOrderId,
        name: "MEHRAÉ",
        description: "Order payment",
        // Cardless-first: UPI and NetBanking are surfaced ahead of other
        // methods rather than removed outright (Razorpay account-level
        // settings control which methods are enabled at all).
        config: {
          display: {
            blocks: {
              upi: { name: "Pay by UPI", instruments: [{ method: "upi" }] },
              netbanking: { name: "NetBanking", instruments: [{ method: "netbanking" }] },
            },
            sequence: ["block.upi", "block.netbanking"],
            preferences: { show_default_blocks: true },
          },
        },
        prefill: {
          name: form.customerName,
          email: form.customerEmail,
          contact: form.customerPhone,
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          console.log("[Razorpay Dummy Success Handler] Payment response received:", response);
          setSubmitting(true);
          try {
            const verifyResult = await verifyRazorpayPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            console.log("[Razorpay Verification Result]:", verifyResult);
            if (verifyResult.ok && verifyResult.orderId) {
              await refresh();
              router.push(`/checkout/success?order=${verifyResult.orderId}`);
            } else {
              // The payment may still be genuine even if this fast-path
              // check couldn't confirm it here (e.g. a dropped connection
              // right after paying) - the webhook is the durable backstop
              // that finalizes the order independently of this callback.
              await refresh();
              router.push("/checkout/success?pending=1");
            }
          } catch (verifyErr) {
            console.error("[Razorpay Verification Error]:", verifyErr);
            await refresh();
            router.push("/checkout/success?pending=1");
          } finally {
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            // User closed the Razorpay modal without paying. The order
            // stays 'pending' with stock reserved; the webhook will mark it
            // failed if Razorpay reports payment.failed, and
            // release_stale_razorpay_orders (scheduled separately) cleans
            // up reservations that are abandoned entirely.
            setSubmitting(false);
            setSubmitError("Payment was not completed. You can try again.");
          },
        },
      });

      if (razorpay.on) {
        razorpay.on("payment.failed", (response: unknown) => {
          setSubmitting(false);
          const failure = response as { error?: { description?: string } } | undefined;
          const reason = failure?.error?.description || "Payment failed at gateway. Please try another payment method.";
          setSubmitError(reason);
        });
      }

      razorpay.open();
    } catch (err) {
      console.error("Checkout failed:", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <Container className="py-16">
        <EmptyState
          title="Your bag is waiting."
          description="Add something to your bag before checking out, or test the payment modal directly."
          action={
            <div className="flex flex-wrap gap-4 justify-center">
              <LinkButton href="/shop">Explore the Collection</LinkButton>
              <LinkButton href="/test-payment" variant="outline">
                Test Razorpay Gateway (Test Mode)
              </LinkButton>
            </div>
          }
        />
      </Container>
    );
  }

  return (
    <Container className="py-12 max-w-5xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-10">
        <div>
          <h1 className="font-display text-4xl">Checkout</h1>
          <p className="text-xs text-charcoal/60 mt-1">
            Secure checkout powered by Razorpay (Test Mode Active)
          </p>
        </div>
        <LinkButton href="/test-payment" variant="outline" className="text-xs">
          ⚡ Open Test Payment Console
        </LinkButton>
      </div>
      <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_360px] gap-12">
        <div className="space-y-10">
          <section>
            <h2 className="eyebrow text-charcoal/60 mb-4">Customer Information</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="customerName">Full Name</Label>
                <Input id="customerName" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} required />
                <FieldError>{errors.customerName}</FieldError>
              </div>
              <div>
                <Label htmlFor="customerEmail">Email</Label>
                <Input id="customerEmail" type="email" value={form.customerEmail} onChange={(e) => update("customerEmail", e.target.value)} required />
                <FieldError>{errors.customerEmail}</FieldError>
              </div>
              <div>
                <Label htmlFor="customerPhone">Phone</Label>
                <Input id="customerPhone" type="tel" placeholder="98765 43210" value={form.customerPhone} onChange={(e) => update("customerPhone", e.target.value)} required />
                <FieldError>{errors.customerPhone}</FieldError>
              </div>
            </div>
          </section>

          <section>
            <h2 className="eyebrow text-charcoal/60 mb-4">Shipping Address</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="shippingAddress">Address</Label>
                <Input id="shippingAddress" value={form.shippingAddress} onChange={(e) => update("shippingAddress", e.target.value)} required />
                <FieldError>{errors.shippingAddress}</FieldError>
              </div>
              <div>
                <Label htmlFor="shippingCity">City</Label>
                <Input id="shippingCity" value={form.shippingCity} onChange={(e) => update("shippingCity", e.target.value)} required />
                <FieldError>{errors.shippingCity}</FieldError>
              </div>
              <div>
                <Label htmlFor="shippingState">State</Label>
                <Input id="shippingState" value={form.shippingState} onChange={(e) => update("shippingState", e.target.value)} required />
                <FieldError>{errors.shippingState}</FieldError>
              </div>
              <div>
                <Label htmlFor="shippingPostalCode">PIN Code</Label>
                <Input id="shippingPostalCode" value={form.shippingPostalCode} onChange={(e) => update("shippingPostalCode", e.target.value)} required />
                <FieldError>{errors.shippingPostalCode}</FieldError>
              </div>
              <div>
                <Label htmlFor="shippingCountry">Country</Label>
                <Input id="shippingCountry" value={form.shippingCountry} onChange={(e) => update("shippingCountry", e.target.value)} required />
              </div>
            </div>
          </section>

          <section>
            <h2 className="eyebrow text-charcoal/60 mb-4">Payment</h2>
            <p className="text-xs text-charcoal/50 mb-4">
              Pay securely via UPI or NetBanking. You&apos;ll be redirected to Razorpay to complete payment - card details are never entered or stored on MEHRAÉ.
            </p>
          </section>
        </div>

        <div className="border border-charcoal/15 p-6 h-max sticky top-28">
          <p className="eyebrow mb-4">Order Summary</p>
          <ul className="space-y-2 text-sm mb-4">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="text-charcoal/70 truncate">
                  {item.product.name} × {item.quantity}
                </span>
                <span className="shrink-0">{formatINR(item.variant.price * item.quantity)}</span>
              </li>
            ))}
          </ul>

          <div className="hairline border-t pt-4 mb-4">
            <Label htmlFor="coupon">Coupon Code</Label>
            <div className="flex gap-2">
              <Input
                id="coupon"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="WELCOME10"
              />
              <Button type="button" variant="outline" onClick={applyCoupon} disabled={couponLoading || !couponInput}>
                Apply
              </Button>
            </div>
            {couponError ? <FieldError>{couponError}</FieldError> : null}
            {couponApplied ? (
              <p className="text-xs text-emerald mt-2">
                {couponApplied.code} applied: -{formatINR(couponApplied.discountAmount)}
              </p>
            ) : null}
          </div>

          <div className="hairline border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-charcoal/60">Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between text-emerald">
                <span>Discount</span>
                <span>-{formatINR(discount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-charcoal/60">Shipping</span>
              <span>{shipping === 0 ? "Free" : formatINR(shipping)}</span>
            </div>
            <div className="flex justify-between font-medium text-base hairline border-t pt-2">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>

          {submitError ? (
            <p role="alert" className="text-xs text-burgundy mt-4">
              {submitError}
            </p>
          ) : null}

          <Button id="razorpay-checkout-btn" type="submit" disabled={submitting} className="w-full mt-6">
            {submitting ? "Opening Razorpay..." : "Checkout with Razorpay"}
          </Button>
        </div>
      </form>
    </Container>
  );
}