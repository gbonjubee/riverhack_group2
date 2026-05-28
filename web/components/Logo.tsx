import { AGENT_NAME, HOUSE_NAME } from "@/lib/brand";

type Props = {
  size?: "sm" | "md";
};

export function Logo({ size = "md" }: Props) {
  const heightClass = size === "sm" ? "text-[11px]" : "text-xs";
  return (
    <div className="flex items-baseline gap-3 select-none">
      <span
        className={`${heightClass} uppercase tracking-[0.32em] text-taupe-dark`}
      >
        {HOUSE_NAME}
      </span>
      <span className="h-3 w-px bg-taupe-line" aria-hidden />
      <span className="font-serif italic text-base text-ink-soft">
        {AGENT_NAME}
      </span>
    </div>
  );
}
