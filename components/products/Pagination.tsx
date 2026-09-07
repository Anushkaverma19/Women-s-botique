"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pageCount <= 1) return null;

  function goTo(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 mt-16">
      <button
        onClick={() => goTo(page - 1)}
        disabled={page <= 1}
        className="eyebrow px-4 py-2 border border-charcoal/25 disabled:opacity-30"
      >
        Previous
      </button>
      <span className="text-sm px-3">
        Page {page} of {pageCount}
      </span>
      <button
        onClick={() => goTo(page + 1)}
        disabled={page >= pageCount}
        className="eyebrow px-4 py-2 border border-charcoal/25 disabled:opacity-30"
      >
        Next
      </button>
    </nav>
  );
}
