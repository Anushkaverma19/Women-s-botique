import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12", className)}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  className,
}: {
  eyebrow?: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-10", className)}>
      {eyebrow ? <p className="eyebrow text-gold mb-3">{eyebrow}</p> : null}
      <h2 className="font-display text-4xl sm:text-5xl gold-underline inline-block pb-2">{title}</h2>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <p className="font-display text-2xl sm:text-3xl mb-3">{title}</p>
      {description ? <p className="text-charcoal/60 max-w-md mb-6">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong.",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center text-center py-24 px-6">
      <p className="font-display text-2xl sm:text-3xl mb-3">{title}</p>
      {description ? <p className="text-charcoal/60 max-w-md">{description}</p> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-charcoal/10", className)} aria-hidden="true" />;
}
