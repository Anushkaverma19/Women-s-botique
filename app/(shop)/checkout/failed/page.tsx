import { XCircle } from "lucide-react";
import { Container } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";

export const metadata = { title: "Payment Failed" };

export default function CheckoutFailedPage() {
  return (
    <Container className="py-24 max-w-xl text-center">
      <XCircle className="mx-auto text-burgundy mb-6" size={48} />
      <h1 className="font-display text-4xl mb-3">Payment could not be completed.</h1>
      <p className="text-charcoal/60 mb-10">
        Your bag has not been charged and nothing has been reserved. Please try again - your items are still in
        your bag.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <LinkButton href="/checkout">Retry Payment</LinkButton>
        <LinkButton href="/cart" variant="outline">
          Review Bag
        </LinkButton>
      </div>
    </Container>
  );
}
