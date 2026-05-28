"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet";
  size?: "md" | "lg";
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full border transition-all duration-300 font-sans tracking-[0.18em] uppercase select-none disabled:opacity-40 disabled:cursor-not-allowed";

const variants: Record<NonNullable<Props["variant"]>, string> = {
  primary:
    "bg-ink text-bg-soft border-ink hover:bg-ink-soft hover:shadow-[0_8px_24px_-12px_rgba(26,20,16,0.4)]",
  ghost:
    "bg-transparent text-ink border-taupe-line hover:border-ink hover:bg-bg-soft",
  quiet:
    "bg-transparent text-taupe-dark border-transparent hover:text-ink",
};

const sizes: Record<NonNullable<Props["size"]>, string> = {
  md: "h-10 px-6 text-[10px]",
  lg: "h-12 px-8 text-[11px]",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", className = "", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    />
  );
});
