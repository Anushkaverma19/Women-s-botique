import { Container } from "@/components/ui/primitives";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <Container className="py-16 max-w-2xl">
      <h1 className="font-display text-5xl mb-8">Terms of Service</h1>
      <div className="space-y-4 text-charcoal/70 text-sm leading-relaxed">
        <p>This storefront is a demonstration project. Payment on this site is simulated - no real payment gateway is used and no real charges are made.</p>
        <p>Product availability, pricing and inventory shown are managed through our live catalogue and may change without notice.</p>
        <p>By creating an account, you agree to provide accurate information and to use this site for its intended demonstrative purpose.</p>
      </div>
    </Container>
  );
}
