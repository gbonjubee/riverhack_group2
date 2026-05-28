"use client";

type Props = {
  label: string;
  selected: boolean;
  onToggle: () => void;
};

export function Chip({ label, selected, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`px-4 h-9 rounded-full border text-sm transition-all duration-300 ${
        selected
          ? "bg-ink text-bg-soft border-ink"
          : "bg-bg-soft text-ink-soft border-taupe-line hover:border-ink hover:bg-bg-warm"
      }`}
    >
      {label}
    </button>
  );
}
