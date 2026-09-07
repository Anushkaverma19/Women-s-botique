"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return <p className="text-sm text-ivory/80">You&apos;re on the list. Welcome to MEHRAÉ.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <div className="flex border border-ivory/30">
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-ivory/40"
        />
        <button type="submit" disabled={status === "loading"} className="px-4 text-xs eyebrow hover:text-gold disabled:opacity-50">
          Join
        </button>
      </div>
      {status === "error" ? <p className="text-xs text-blush">Something went wrong. Please try again.</p> : null}
    </form>
  );
}
