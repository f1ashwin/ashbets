"use client";

import { useTransition, useState } from "react";
import { placeBet, type PlaceBetInput } from "@/lib/actions/place-bet";

export function PlaceBetButton({
  payload,
  disabled,
  label = "Place",
}: {
  payload: PlaceBetInput;
  disabled?: boolean;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {status ? (
        <span className="text-[10px] text-gray-500">{status}</span>
      ) : null}
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => {
          setStatus(null);
          startTransition(async () => {
            const res = await placeBet(payload);
            if (res.ok) {
              setStatus(res.paperOnly ? "paper placed" : "placed");
            } else {
              setStatus(res.error);
            }
          });
        }}
        className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
      >
        {pending ? "…" : label}
      </button>
    </div>
  );
}
