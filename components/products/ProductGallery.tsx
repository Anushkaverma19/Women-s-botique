"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import type { ProductImage } from "@/types/database";

export function ProductGallery({ images, productName }: { images: ProductImage[]; productName: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  return (
    <div>
      <div className="relative aspect-[3/4] bg-parchment overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={current?.id ?? "empty"}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute inset-0"
          >
            {current ? (
              <Image
                src={current.image_url}
                alt={current.alt_text || productName}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
      {images.length > 1 ? (
        <div className="flex gap-3 mt-4">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1} of ${productName}`}
              aria-current={active === i}
              className={`relative h-20 w-16 shrink-0 overflow-hidden border ${
                active === i ? "border-charcoal" : "border-transparent opacity-70"
              }`}
            >
              <Image src={img.image_url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
