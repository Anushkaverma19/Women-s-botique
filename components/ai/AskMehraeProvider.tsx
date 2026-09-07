"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { AskMehraeDrawer } from "@/components/ai/AskMehraeDrawer";

interface AskMehraeContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  openWithPrompt: (prompt: string) => void;
  seedPrompt: string | null;
}

const AskMehraeContext = createContext<AskMehraeContextValue | null>(null);

export function AskMehraeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [seedPrompt, setSeedPrompt] = useState<string | null>(null);

  function openWithPrompt(prompt: string) {
    setSeedPrompt(prompt);
    setOpen(true);
  }

  return (
    <AskMehraeContext.Provider value={{ open, setOpen, openWithPrompt, seedPrompt }}>
      {children}
      <AskMehraeLauncher />
      {open ? <AskMehraeDrawer onClose={() => setOpen(false)} seedPrompt={seedPrompt} /> : null}
    </AskMehraeContext.Provider>
  );
}

export function useAskMehrae() {
  const ctx = useContext(AskMehraeContext);
  if (!ctx) throw new Error("useAskMehrae must be used within AskMehraeProvider");
  return ctx;
}

function AskMehraeLauncher() {
  const { setOpen, open } = useAskMehrae();
  if (open) return null;
  return (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-charcoal text-ivory px-5 py-3.5 shadow-lg hover:bg-burgundy transition-colors"
    >
      <Sparkles size={16} />
      <span className="eyebrow">Ask MEHRAÉ</span>
    </button>
  );
}
