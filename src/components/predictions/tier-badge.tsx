import type { RiskTier } from "@/lib/predictions/risk-tier";

const LABELS: Record<Exclude<RiskTier, "rejected">, string> = {
  high_confidence: "High Confidence",
  balanced: "Balanced",
  upside: "Upside",
};

const STYLES: Record<Exclude<RiskTier, "rejected">, string> = {
  high_confidence: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  balanced: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  upside: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
};

export function TierBadge({ tier }: { tier: Exclude<RiskTier, "rejected"> }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[tier]}`}>
      {LABELS[tier]}
    </span>
  );
}
