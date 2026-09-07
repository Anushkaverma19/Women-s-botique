import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

const base =
  "inline-flex items-center justify-center gap-2 font-sans text-sm tracking-wide uppercase transition-colors duration-300 disabled:opacity-40 disabled:pointer-events-none";

const variants = {
  primary: "bg-charcoal text-ivory px-8 py-3 hover:bg-burgundy border border-charcoal hover:border-burgundy",
  outline: "border border-charcoal px-8 py-3 hover:bg-charcoal hover:text-ivory",
  ghost: "px-3 py-2 hover:text-burgundy",
  gold: "bg-gold text-charcoal px-8 py-3 hover:bg-burgundy hover:text-ivory border border-gold hover:border-burgundy",
};

type Variant = keyof typeof variants;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={cn(base, variants[variant], className)} {...props} />;
}

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: Variant;
}

export function LinkButton({ href, variant = "primary", className, ...props }: LinkButtonProps) {
  return <Link href={href} className={cn(base, variants[variant], className)} {...props} />;
}
