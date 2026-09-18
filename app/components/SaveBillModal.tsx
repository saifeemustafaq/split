"use client";

import { useEffect, useRef, useState } from "react";

export type SaveMode = "update" | "new";

interface SaveBillModalProps {
  defaultName: string;
  /** Name of the bill currently loaded from history, if any. */
  currentBillName: string | null;
  onClose: () => void;
  onSave: (name: string, mode: SaveMode) => Promise<void>;
}

/** Mounted only while open, so every visit starts from a clean field. */
export default function SaveBillModal({
  defaultName,
  currentBillName,
  onClose,
  onSave,
}: SaveBillModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(currentBillName ?? defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const submit = async (mode: SaveMode) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(name.trim() || defaultName, mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this bill.");
      setBusy(false);
    }
  };

  const primaryMode: SaveMode = currentBillName ? "update" : "new";

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 dark:shadow-black/30">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
          {currentBillName ? "Save changes" : "Save bill"}
        </h2>

        <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
          Name
        </label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit(primaryMode);
            }
          }}
          placeholder={defaultName}
          className="h-9 w-full rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600"
        />

        {error && (
          <p className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          {currentBillName && (
            <button
              onClick={() => submit("new")}
              disabled={busy}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Save as new
            </button>
          )}
          <button
            onClick={() => submit(primaryMode)}
            disabled={busy}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          >
            {busy ? "Saving..." : currentBillName ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
