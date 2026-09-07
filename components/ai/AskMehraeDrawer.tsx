"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Sparkles, Send } from "lucide-react";
import { formatINR, cn } from "@/lib/utils";

interface RecommendedProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  basePrice: number;
  compareAtPrice: number | null;
  image: string | null;
  inStock: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  recommendations?: { product: RecommendedProduct; reason: string }[];
}

const SUGGESTED_PROMPTS = [
  "Find my wedding look",
  "Something in burgundy",
  "Under ₹10,000",
  "Help me choose a gift",
];

export function AskMehraeDrawer({
  onClose,
  seedPrompt,
}: {
  onClose: () => void;
  seedPrompt: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Namaste, I'm ASK MEHRAÉ. Tell me what you're looking for - an occasion, a colour, a budget - and I'll find real pieces from the current collection for you.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (seedPrompt && !seeded.current) {
      seeded.current = true;
      void send(seedPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedPrompt]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: nextMessages
            .slice(-8)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error ?? "Something went wrong. Please try again." },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message, recommendations: data.recommendations ?? [] },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I couldn't reach the styling service. Please try again shortly." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 sm:flex sm:items-stretch sm:justify-end" role="dialog" aria-modal="true" aria-label="ASK MEHRAÉ shopping assistant">
      <button aria-label="Close ASK MEHRAÉ" className="absolute inset-0 bg-charcoal/40 hidden sm:block" onClick={onClose} />
      <div className="relative bg-ivory w-full h-full sm:h-auto sm:w-[420px] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-5 hairline border-b bg-charcoal text-ivory">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-gold" />
            <span className="eyebrow">Ask MEHRAÉ</span>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] px-4 py-3 text-sm",
                  m.role === "user" ? "bg-charcoal text-ivory" : "bg-parchment"
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                {m.recommendations && m.recommendations.length > 0 ? (
                  <ul className="mt-3 space-y-3">
                    {m.recommendations.map(({ product, reason }) => (
                      <RecommendationCard key={product.id} product={product} reason={reason} onNavigate={onClose} />
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="flex justify-start">
              <div className="bg-parchment px-4 py-3 text-sm text-charcoal/60">Thinking...</div>
            </div>
          ) : null}
        </div>

        {messages.length <= 1 ? (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => send(prompt)}
                className="text-xs border border-charcoal/25 px-3 py-1.5 hover:border-charcoal"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 px-5 py-4 hairline border-t"
        >
          <label htmlFor="ask-mehrae-input" className="sr-only">
            Message ASK MEHRAÉ
          </label>
          <input
            id="ask-mehrae-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell us what you're looking for..."
            className="flex-1 bg-transparent outline-none text-sm py-2"
          />
          <button type="submit" aria-label="Send" disabled={loading} className="p-2 disabled:opacity-40">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

function RecommendationCard({
  product,
  reason,
  onNavigate,
}: {
  product: RecommendedProduct;
  reason: string;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  return (
    <li className="bg-ivory border border-charcoal/15 p-3 flex gap-3">
      <div className="relative h-20 w-16 shrink-0 bg-parchment">
        {product.image ? (
          <Image src={product.image} alt={product.name} fill sizes="64px" className="object-cover" />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-base leading-tight">{product.name}</p>
        <p className="text-xs text-charcoal/60 mt-1">{reason}</p>
        <p className="text-sm mt-1">
          {formatINR(product.basePrice)}
          {!product.inStock ? <span className="text-burgundy"> · Out of stock</span> : null}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <Link href={`/products/${product.slug}`} onClick={onNavigate} className="text-xs eyebrow underline">
            View Product
          </Link>
          {product.inStock ? (
            <button
              disabled={adding}
              onClick={() => {
                setAdding(true);
                // The AI card can't know the exact variant without another
                // lookup - route to the product page for size/colour
                // selection rather than guessing a SKU on the shopper's
                // behalf.
                setAdded(true);
                onNavigate();
                router.push(`/products/${product.slug}`);
              }}
              className="text-xs eyebrow underline text-burgundy disabled:opacity-40"
            >
              {added ? "Opening..." : "Add to Bag"}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
