"use client";

import { TextareaHTMLAttributes, InputHTMLAttributes } from "react";

type TextProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
};

export function TextField({ label, hint, className = "", ...rest }: TextProps) {
  return (
    <label className="block">
      {label && (
        <span className="block text-[11px] uppercase tracking-[0.24em] text-taupe-dark mb-2">
          {label}
        </span>
      )}
      <input
        {...rest}
        className={`w-full bg-transparent border-b border-taupe-line focus:border-ink outline-none py-3 font-serif text-2xl text-ink placeholder:text-taupe transition-colors ${className}`}
      />
      {hint && (
        <span className="block text-xs text-taupe-dark mt-2 italic font-serif">
          {hint}
        </span>
      )}
    </label>
  );
}

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
};

export function TextArea({ label, hint, className = "", ...rest }: AreaProps) {
  return (
    <label className="block">
      {label && (
        <span className="block text-[11px] uppercase tracking-[0.24em] text-taupe-dark mb-2">
          {label}
        </span>
      )}
      <textarea
        {...rest}
        className={`w-full bg-bg-soft border border-taupe-line rounded-md focus:border-ink outline-none p-4 font-sans text-base text-ink placeholder:text-taupe transition-colors resize-none ${className}`}
      />
      {hint && (
        <span className="block text-xs text-taupe-dark mt-2 italic font-serif">
          {hint}
        </span>
      )}
    </label>
  );
}
