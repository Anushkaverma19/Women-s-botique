"use client";

import { useEffect } from "react";
import { Container, ErrorState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

export default function ProductError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-16">
      <ErrorState title="We couldn't load this product." description="Please try again." />
      <div className="flex justify-center">
        <Button onClick={reset}>Try Again</Button>
      </div>
    </Container>
  );
}
