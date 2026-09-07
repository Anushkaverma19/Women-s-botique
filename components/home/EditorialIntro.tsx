"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Container } from "@/components/ui/primitives";

export function EditorialIntro() {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], [prefersReducedMotion ? 0 : -40, prefersReducedMotion ? 0 : 40]);

  return (
    <section ref={ref} className="py-24 sm:py-32 overflow-hidden">
      <Container className="grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <p className="eyebrow text-gold mb-4">Our Philosophy</p>
          <h2 className="font-display text-4xl sm:text-5xl mb-6 leading-tight">Tradition, Reimagined.</h2>
          <p className="text-charcoal/70 leading-relaxed max-w-md">
            MEHRAÉ begins where heritage textile craft meets a contemporary eye. Every silhouette is drawn from
            centuries of Indian weaving and embroidery, then cut for the way women actually move today - a
            wardrobe of modern heirlooms, made to be worn, not archived.
          </p>
        </motion.div>
        <motion.div style={{ y: imageY }} className="relative aspect-[4/5]">
          <Image
            src="/products/anaya-gold-silk-saree.jpg"
            alt="MEHRAÉ editorial - gold silk saree"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </motion.div>
      </Container>
    </section>
  );
}
