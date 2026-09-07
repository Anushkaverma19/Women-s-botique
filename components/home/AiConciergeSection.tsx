"use client";

import { Sparkles } from "lucide-react";
import { Container } from "@/components/ui/primitives";
import { useAskMehrae } from "@/components/ai/AskMehraeProvider";

export function AiConciergeSection() {
  const { setOpen } = useAskMehrae();
  return (
    <section className="py-24 bg-charcoal text-ivory" aria-labelledby="concierge-heading">
      <Container className="text-center max-w-2xl">
        <Sparkles className="mx-auto text-gold mb-5" size={28} />
        <p className="eyebrow text-gold-soft mb-4">Your Personal Shopping Concierge</p>
        <h2 id="concierge-heading" className="font-display text-4xl sm:text-5xl mb-5">
          ASK MEHRAÉ
        </h2>
        <p className="text-ivory/70 leading-relaxed mb-8">
          Tell us what you&apos;re looking for - an occasion, a colour, a budget - and our styling concierge will
          find real pieces from the current collection for you.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="eyebrow bg-gold text-charcoal px-8 py-3.5 hover:bg-ivory transition-colors"
        >
          Ask MEHRAÉ
        </button>
      </Container>
    </section>
  );
}
