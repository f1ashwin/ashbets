"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "ashbets:bookmaker-url";

export function BookmakerUrlField() {
  const [url, setUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUrl(localStorage.getItem(STORAGE_KEY) ?? "");
  }, []);

  const handleSave = () => {
    const trimmed = url.trim();
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
    else localStorage.removeItem(STORAGE_KEY);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs uppercase tracking-wide text-gray-500" htmlFor="bookmaker-url">
        Preferred Bookmaker URL
      </label>
      <p className="text-[11px] text-gray-400">
        Opened in a new tab when you tap &ldquo;Copy&rdquo; on a bet slip. Stored locally in your browser only.
      </p>
      <div className="flex gap-2">
        <input
          id="bookmaker-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.bet365.com"
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </div>
  );
}
