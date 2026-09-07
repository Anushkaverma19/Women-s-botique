import { Container } from "@/components/ui/primitives";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <Container className="py-16 max-w-2xl">
      <h1 className="font-display text-5xl mb-8">Privacy Policy</h1>
      <div className="space-y-4 text-charcoal/70 text-sm leading-relaxed">
        <p>
          This is a demonstration project. Account information (name, email) and order details you provide are
          stored in our Supabase database and used solely to operate your account, process orders, and provide
          support. We do not sell personal data to third parties.
        </p>
        <p>
          Messages sent to ASK MEHRAÉ are used only to retrieve and recommend products from our catalogue for
          that conversation and are not used for any other purpose.
        </p>
        <p>You may request deletion of your account and associated data at any time by contacting us.</p>
      </div>
    </Container>
  );
}
