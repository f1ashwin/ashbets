"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard:error]", error);
  }, [error]);

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 dark:border-rose-900 dark:bg-rose-950">
      <h2 className="text-lg font-semibold text-rose-900 dark:text-rose-100">Something went wrong.</h2>
      <p className="mt-2 text-sm text-rose-800 dark:text-rose-200">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded bg-rose-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-800"
      >
        Try again
      </button>
    </div>
  );
}
