import { AGENT_NAME } from "@/lib/brand";

type Props = {
  size?: "sm" | "md";
};

export function Logo({ size = "md" }: Props) {
  const wordmark = size === "sm" ? "text-sm" : "text-base";
  return (
    <div className="flex items-baseline gap-2 select-none">
      <span className={`${wordmark} font-serif italic tracking-tight text-ink`}>
        {AGENT_NAME}
      </span>
      <span className="text-[10px] uppercase tracking-[0.28em] text-taupe-dark">
        · for marketing
      </span>
    </div>
  );
}
