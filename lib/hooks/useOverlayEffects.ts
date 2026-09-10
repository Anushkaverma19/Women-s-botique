"use client";

import { useEffect } from "react";

/**
 * Shared behavior for full-screen overlays anchored in the navbar (the
 * mobile menu drawer, the search overlay): while `active`, the page behind
 * the overlay can no longer scroll - without this, touch-scrolling inside
 * (or even just above) the drawer on a phone also scrolls the page underneath
 * it, which is the main reason the mobile menu has felt broken/unusable -
 * and Escape closes the overlay, matching the existing tap-outside-to-close
 * affordance for keyboard users.
 */
export function useOverlayEffects(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, onClose]);
}
