import { formatAge } from "@/lib/utils/formatters";
import type { FreshnessInfo } from "@/lib/predictions/staleness";

const STYLES: Record<FreshnessInfo["freshness"], string> = {
  fresh: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  stale: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  expired: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const LABELS: Record<FreshnessInfo["freshness"], string> = {
  fresh: "fresh",
  stale: "stale",
  expired: "expired",
};

export function FreshnessBadge({
  freshness,
  recordedAt,
}: {
  freshness: FreshnessInfo;
  recordedAt: Date;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${STYLES[freshness.freshness]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[freshness.freshness]} · {formatAge(recordedAt)}
    </span>
  );
}
