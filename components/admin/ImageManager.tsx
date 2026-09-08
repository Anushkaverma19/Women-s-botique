"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { ProductImage } from "@/types/database";

export function ImageManager({ productId, images }: { productId: string; images: ProductImage[] }) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function addImage(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/admin/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          imageUrl,
          altText,
          sortOrder: images.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add image.");
        return;
      }
      setImageUrl("");
      setAltText("");
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  async function updateAlt(id: string, altText: string) {
    setBusyId(id);
    try {
      await fetch(`/api/admin/images/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function removeImage(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/images/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not remove image.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const inputClass = "border border-black/15 bg-white rounded px-2.5 py-1.5 text-sm outline-none focus:border-black/40";

  return (
    <div className="bg-white border border-black/10 rounded p-6 max-w-3xl">
      <h2 className="text-sm font-medium mb-4">Images</h2>

      <div className="flex flex-wrap gap-4 mb-6">
        {images.map((img) => (
          <div key={img.id} className="w-32">
            <div className="relative aspect-[3/4] bg-black/5 mb-2 overflow-hidden rounded">
              <Image src={img.image_url} alt={img.alt_text} fill sizes="128px" className="object-cover" />
            </div>
            <input
              defaultValue={img.alt_text}
              placeholder="Alt text"
              className={`${inputClass} w-full mb-1.5 text-xs`}
              onBlur={(e) => {
                if (e.target.value !== img.alt_text) updateAlt(img.id, e.target.value);
              }}
            />
            <button
              type="button"
              disabled={busyId === img.id}
              onClick={() => removeImage(img.id)}
              className="text-xs text-burgundy hover:underline disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        {images.length === 0 ? <p className="text-sm text-black/40">No images yet.</p> : null}
      </div>

      <form onSubmit={addImage} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <label className="block text-xs text-black/50 mb-1">Image path</label>
          <input
            required
            placeholder="/products/example.jpg"
            className={inputClass}
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-black/50 mb-1">Alt text</label>
          <input
            required
            placeholder="Descriptive alt text"
            className={inputClass}
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
          />
        </div>
        <button type="submit" disabled={adding} className="text-xs bg-[#1a1a1a] text-white px-4 py-2 rounded disabled:opacity-50 h-9">
          {adding ? "Adding..." : "+ Add Image"}
        </button>
      </form>
      <p className="text-xs text-black/40 mt-2">
        Reference an existing file already in <code>public/</code> (e.g. <code>/products/your-file.jpg</code>) - this
        project does not include an upload feature.
      </p>
      {error ? <p className="text-xs text-burgundy mt-2">{error}</p> : null}
    </div>
  );
}
