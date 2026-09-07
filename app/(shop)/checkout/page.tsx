"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartContext";
import { Container, EmptyState } from "@/components/ui/primitives";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/field";
import { formatINR } from "@/lib/utils";
import { checkoutSchema } from "@/lib/validations/schemas";

const FREE_SHIPPING_THRESHOLD = 5000;
const FLAT_SHIPPING = 149;

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
  const { items, subtotal } = useCart();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(initialForm);
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [payment, setPayment] = useState<"success" | "fail">("success");
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

    const parsed = checkoutSchema.safeParse({
      ...form,
      couponCode: couponApplied?.code ?? "",
      paymentOutcome: payment,
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
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "PAYMENT_FAILED") {
          router.push("/checkout/failed");
          return;
        }
        setSubmitError(data.error ?? "We couldn't place this order. Please try again.");
        return;
      }
      router.push(`/checkout/success?order=${data.order.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <Container className="py-16">
        <EmptyState
          title="Your bag is waiting."
          description="Add something to your bag before checking out."
          action={<LinkButton href="/shop">Explore the Collection</LinkButton>}
        />
      </Container>
    );
  }

  return (
    <Container className="py-12 max-w-5xl">
      <h1 className="font-display text-4xl mb-10">Checkout</h1>
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
              Payment is simulated for this project - no real payment gateway is used.
            </p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 border border-charcoal/20 px-4 py-3 cursor-pointer">
                <input type="radio" name="payment" checked={payment === "success"} onChange={() => setPayment("success")} />
                Simulate Successful Payment
              </label>
              <label className="flex items-center gap-3 border border-charcoal/20 px-4 py-3 cursor-pointer">
                <input type="radio" name="payment" checked={payment === "fail"} onChange={() => setPayment("fail")} />
                Simulate Failed Payment
              </label>
            </div>
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

          <Button type="submit" disabled={submitting} className="w-full mt-6">
            {submitting ? "Placing Order..." : "Place Order"}
          </Button>
        </div>
      </form>
    </Container>
  );
}
