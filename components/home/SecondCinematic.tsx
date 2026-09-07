"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

export function SecondCinematic() {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.94, 1, 1.04]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.35, 0.65, 1], [0.75, 0.35, 0.35, 0.75]);
  const textY = useTransform(scrollYProgress, [0, 0.5, 1], [40, 0, -40]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0, 1, 1, 0]);

  return (
    <section ref={ref} className="relative h-[130vh] -mt-16 sm:-mt-24">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <motion.div style={{ scale: prefersReducedMotion ? 1 : scale }} className="absolute inset-0">
          <video
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            poster="/products/yamini-midnight-blue-lehenga.jpg"
          >
            <source src="/videos/campaign-continuation.mp4" type="video/mp4" />
          </video>
          <motion.div
            style={{ opacity: prefersReducedMotion ? 0.5 : overlayOpacity }}
            className="absolute inset-0 bg-charcoal"
          />
        </motion.div>

        <motion.div
          style={{ y: prefersReducedMotion ? 0 : textY, opacity: prefersReducedMotion ? 1 : textOpacity }}
          className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 text-ivory"
        >
          <p className="eyebrow text-gold-soft mb-5">A Continuing Story</p>
          <h2 className="font-display text-5xl sm:text-7xl mb-8 max-w-3xl">THE ART OF BECOMING</h2>
          <p className="max-w-xl text-ivory/80 leading-relaxed">
            Every MEHRAÉ piece begins as thread, dye and the unhurried hands of a karigar. What emerges is not
            simply an outfit but an identity in motion - heritage reworked for the woman who carries it forward.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
