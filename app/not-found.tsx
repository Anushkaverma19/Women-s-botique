import { Container } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <p className="eyebrow text-gold mb-4">404</p>
      <h1 className="font-display text-4xl mb-4">This page has wandered off.</h1>
      <p className="text-charcoal/60 mb-8">The piece you&apos;re looking for may have moved or sold out.</p>
      <LinkButton href="/shop">Explore the Collection</LinkButton>
    </Container>
  );
}
