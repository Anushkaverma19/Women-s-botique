"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";

export default function ShopError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-16">
      <ErrorState
        title="We couldn't load the collection."
        description="Please try again - your bag and account are unaffected."
      />
      <div className="flex justify-center">
        <Button onClick={reset}>Try Again</Button>
      </div>
    </Container>
  );
}
