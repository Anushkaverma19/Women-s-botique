"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { LinkButton } from "@/components/ui/button";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  const scale = useTransform(scrollYProgress, [0, 1], [1, prefersReducedMotion ? 1 : 1.15]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : 80]);

  return (
    <section ref={ref} className="relative h-[100svh] w-full overflow-hidden bg-charcoal">
      <motion.div style={{ scale }} className="absolute inset-0">
        <video
          className="h-full w-full object-cover opacity-80"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/products/aanya-coral-bridal-lehenga.jpg"
        >
          <source src="/videos/hero-campaign.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/20 to-charcoal/50" />
      </motion.div>

      <motion.div
        style={{ opacity, y }}
        className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 text-ivory"
      >
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="eyebrow text-gold-soft mb-6"
        >
          Modern Heirlooms, Rooted in India.
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35 }}
          className="font-display text-6xl sm:text-8xl lg:text-9xl tracking-wide"
        >
          MEHRAÉ
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.55 }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <LinkButton href="/shop" variant="gold">
            Explore the Collection
          </LinkButton>
          <LinkButton href="/about" variant="outline" className="border-ivory text-ivory hover:bg-ivory hover:text-charcoal">
            Meet MEHRAÉ
          </LinkButton>
        </motion.div>
      </motion.div>
    </section>
  );
}
