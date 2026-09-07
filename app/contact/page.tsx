import { Container } from "@/components/ui/primitives";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <Container className="py-16 max-w-2xl">
      <h1 className="font-display text-5xl mb-8">Contact Us</h1>
      <div className="space-y-4 text-charcoal/70 text-sm">
        <p>For order support, styling questions, or press enquiries, reach us at:</p>
        <p className="text-charcoal">hello@mehrae.example</p>
        <p className="text-charcoal">+91 98765 43210</p>
        <p>Monday - Saturday, 10am - 7pm IST</p>
      </div>
    </Container>
  );
}
