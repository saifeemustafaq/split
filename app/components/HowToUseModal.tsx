"use client";

import { useEffect, useRef } from "react";

interface HowToUseModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HowToUseModal({ open, onClose }: HowToUseModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="3" y1="3" x2="11" y2="11" />
            <line x1="11" y1="3" x2="3" y2="11" />
          </svg>
        </button>

        <h2 className="mb-4 text-base font-semibold text-gray-900">
          How to use Splitor
        </h2>

        <div className="space-y-4 text-sm leading-relaxed text-gray-600">
          <section>
            <h3 className="mb-1 font-medium text-gray-900">Quick start</h3>
            <p>
              Add members at the top, then type item costs in the rows below.
              Tap the member initials to assign who shares each item. Totals
              update instantly.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-medium text-gray-900">Quick-entry shorthand</h3>
            <p>
              Type the amount followed by member initials to auto-assign.
              For example, if you have members <strong>M</strong>ustafa and{" "}
              <strong>R</strong>ohit:
            </p>
            <ul className="mt-1.5 space-y-1 pl-4">
              <li className="list-disc">
                <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-800">100mr</code>{" "}
                — $100 split between M and R
              </li>
              <li className="list-disc">
                <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-800">50m</code>{" "}
                — $50 for M only
              </li>
              <li className="list-disc">
                <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-800">25mra</code>{" "}
                — $25 split among all three
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-1 font-medium text-gray-900">Keyboard navigation</h3>
            <ul className="space-y-1 pl-4">
              <li className="list-disc">
                <strong>Tab</strong> on cost field — jump to next row
              </li>
              <li className="list-disc">
                <strong>Enter</strong> on cost field — jump to next row
              </li>
              <li className="list-disc">
                <strong>Tab</strong> on description — move to cost in same row
              </li>
              <li className="list-disc">
                <strong>Enter</strong> on description — jump to next row&apos;s description
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-1 font-medium text-gray-900">Tax &amp; Delivery</h3>
            <p>
              Use the <strong>+ Tax</strong> and <strong>+ Delivery</strong>{" "}
              buttons to add extra charges. These are distributed proportionally
              based on each person&apos;s share of the subtotal.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-medium text-gray-900">Export</h3>
            <p>
              Use <strong>Download</strong> or <strong>Share</strong> to export
              the split as a PNG image or PDF document.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
