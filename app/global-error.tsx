"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <Container className="py-24 text-center">
          <h1 className="font-display text-4xl mb-4">Something went wrong.</h1>
          <p className="text-charcoal/60 mb-8">
            We couldn&apos;t complete that request. Please try again in a moment.
          </p>
          <Button onClick={reset}>Try Again</Button>
        </Container>
      </body>
    </html>
  );
}
