"use client";

import { Sparkles } from "lucide-react";
import { useAskMehrae } from "@/components/ai/AskMehraeProvider";

export function StylingSuggestionButton({ productName }: { productName: string }) {
  const { openWithPrompt } = useAskMehrae();
  return (
    <button
      onClick={() => openWithPrompt(`How would you style the ${productName}, and what would pair well with it?`)}
      className="flex items-center gap-2 eyebrow border border-charcoal/25 px-4 py-3 hover:border-charcoal w-full sm:w-auto justify-center"
    >
      <Sparkles size={14} className="text-gold" />
      Ask MEHRAÉ how to style this
    </button>
  );
}
