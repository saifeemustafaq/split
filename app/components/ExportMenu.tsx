"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { Member, Entry } from "../lib/types";
import {
  buildShareFiles,
  canShareFiles,
  captureReceipt,
  downloadExcel,
  downloadFile,
  downloadPdf,
  downloadPng,
  prefetchExportModules,
  shareFile,
  type ExportFormat,
  type ShareFiles,
} from "../lib/exporters";
import ReceiptView from "./ReceiptView";

interface ExportMenuProps {
  entries: Entry[];
  members: Member[];
  showDescription: boolean;
  subtotals: Record<string, number>;
  totals: Record<string, number>;
  grandSubtotal: number;
  grandTotal: number;
  taxValue: number;
  deliveryValue: number;
  onSave: () => void;
  onOpenHistory: () => void;
  canSave: boolean;
  isDirty: boolean;
}

export default function ExportMenu({
  entries,
  members,
  showDescription,
  subtotals,
  totals,
  grandSubtotal,
  grandTotal,
  taxValue,
  deliveryValue,
  onSave,
  onOpenHistory,
  canSave,
  isDirty,
}: ExportMenuProps) {
  const [openMenu, setOpenMenu] = useState<"download" | "share" | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareFiles, setShareFiles] = useState<ShareFiles | null>(null);
  const [pendingShare, setPendingShare] = useState<ExportFormat | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [fileShareSupported, setFileShareSupported] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const prepRef = useRef<Promise<ShareFiles> | null>(null);
  const liveSignature = useRef("");

  const filledEntries = entries.filter((e) => e.cost > 0);
  const disabled = filledEntries.length === 0;

  /** Identifies the receipt the prepared files belong to. */
  const signature = useMemo(
    () =>
      JSON.stringify([
        filledEntries,
        members,
        showDescription,
        taxValue,
        deliveryValue,
      ]),
    [filledEntries, members, showDescription, taxValue, deliveryValue]
  );

  useEffect(() => setFileShareSupported(canShareFiles()), []);

  useEffect(() => {
    if (!disabled) prefetchExportModules();
  }, [disabled]);

  useEffect(() => {
    liveSignature.current = signature;
    prepRef.current = null;
    setShareFiles(null);
  }, [signature]);

  useEffect(() => {
    if (!openMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMenu]);

  const prepareShare = useCallback(() => {
    const el = receiptRef.current;
    if (!el) return Promise.reject(new Error("Receipt is not ready."));
    if (prepRef.current) return prepRef.current;

    const forSignature = signature;
    const promise = buildShareFiles(el).then(
      (files) => {
        if (liveSignature.current === forSignature) setShareFiles(files);
        return files;
      },
      (err) => {
        prepRef.current = null;
        throw err;
      }
    );
    prepRef.current = promise;
    return promise;
  }, [signature]);

  /** Opening the menu is itself a tap, so it buys us time to render the files. */
  useEffect(() => {
    if (openMenu !== "share" || !fileShareSupported || disabled) return;
    prepareShare().catch(() => {});
  }, [openMenu, fileShareSupported, disabled, prepareShare]);

  const handleDownload = useCallback(
    async (format: ExportFormat) => {
      if (!receiptRef.current || busy) return;
      setOpenMenu(null);
      setBusy(true);
      try {
        const canvas = await captureReceipt(receiptRef.current);
        if (format === "png") await downloadPng(canvas);
        else await downloadPdf(canvas);
      } finally {
        setBusy(false);
      }
    },
    [busy]
  );

  /** A dismissed share sheet is not a failure; anything else falls back to a download. */
  const settleShare = useCallback((file: File, promise: Promise<void>) => {
    promise.catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      downloadFile(file);
    });
  }, []);

  const handleShare = useCallback(
    (format: ExportFormat) => {
      if (!fileShareSupported) {
        void handleDownload(format);
        return;
      }
      setOpenMenu(null);
      const ready = shareFiles?.[format];
      if (ready) {
        // Called inside the tap handler on purpose: WebKit revokes share
        // permission the moment we await anything.
        settleShare(ready, shareFile(ready));
        return;
      }
      setShareError(null);
      setPendingShare(format);
      prepareShare().catch(() =>
        setShareError("Could not prepare the receipt.")
      );
    },
    [fileShareSupported, handleDownload, prepareShare, settleShare, shareFiles]
  );

  const confirmShare = useCallback(() => {
    const file = pendingShare ? shareFiles?.[pendingShare] : null;
    if (!file) return;
    setPendingShare(null);
    settleShare(file, shareFile(file));
  }, [pendingShare, shareFiles, settleShare]);

  const handleExcelExport = useCallback(async () => {
    if (busy) return;
    setOpenMenu(null);
    setBusy(true);
    try {
      await downloadExcel(entries, members, showDescription, taxValue, deliveryValue);
    } finally {
      setBusy(false);
    }
  }, [busy, entries, members, showDescription, taxValue, deliveryValue]);

  const dropdownItems = (action: "download" | "share", isMobile: boolean) => (
    <div
      className={`absolute z-50 min-w-[100px] rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:shadow-black/30 ${
        isMobile ? "bottom-full mb-1" : "top-full mt-1"
      }`}
    >
      <button
        onClick={() =>
          action === "share" ? handleShare("png") : handleDownload("png")
        }
        className="block w-full px-4 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        as PNG
      </button>
      <button
        onClick={() =>
          action === "share" ? handleShare("pdf") : handleDownload("pdf")
        }
        className="block w-full px-4 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        as PDF
      </button>
      <button
        onClick={handleExcelExport}
        className="block w-full px-4 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        as Excel
      </button>
    </div>
  );

  const renderButtons = (isMobile: boolean) => {
    const buttonBase = `inline-flex items-center justify-center gap-1.5 rounded-md bg-gray-900 px-3 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 dark:disabled:hover:bg-gray-100 ${
      isMobile ? "py-2.5" : "py-1.5"
    }`;
    const iconButton = `${buttonBase} ${isMobile ? "w-11 shrink-0 px-0" : ""}`;

    return (
      <div
        ref={!isMobile ? menuRef : undefined}
        className={`gap-2 ${isMobile ? "flex w-full" : "inline-flex"}`}
      >
        <button
          onClick={onSave}
          disabled={!canSave}
          className={`relative ${iconButton}`}
          title="Save bill"
          aria-label="Save bill"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {!isMobile && "Save"}
          {canSave && isDirty && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500" />
          )}
        </button>
        <button
          onClick={onOpenHistory}
          className={iconButton}
          title="Recent bills"
          aria-label="Recent bills"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v5h5" />
            <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
            <path d="M12 7v5l4 2" />
          </svg>
          {!isMobile && "Recent"}
        </button>
        <div className={`relative ${isMobile ? "flex-1" : ""}`}>
          <button
            disabled={disabled || busy}
            onClick={() => setOpenMenu(openMenu === "download" ? null : "download")}
            className={`w-full ${buttonBase}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {busy ? "..." : "Download"}
          </button>
          {openMenu === "download" && dropdownItems("download", isMobile)}
        </div>
        <div className={`relative ${isMobile ? "flex-1" : ""}`}>
          <button
            disabled={disabled || busy}
            onClick={() => setOpenMenu(openMenu === "share" ? null : "share")}
            className={`w-full ${buttonBase}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
          {openMenu === "share" && dropdownItems("share", isMobile)}
        </div>
        <a
          href="https://www.linkedin.com/in/saifeemustafa/"
          target="_blank"
          rel="noopener noreferrer"
          className={iconButton}
          title="Contact"
          aria-label="Contact"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          {!isMobile && "Contact"}
        </a>
      </div>
    );
  };

  return (
    <>
      {/* Desktop inline buttons */}
      <div className="hidden md:block">{renderButtons(false)}</div>

      {/* Mobile fixed bottom bar */}
      <div
        ref={menuRef}
        className="fixed right-0 bottom-0 left-0 z-40 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 md:hidden"
      >
        <div className="mx-auto max-w-5xl">{renderButtons(true)}</div>
      </div>

      {/* Share confirmation: the prepared file needs a fresh tap to reach the OS sheet */}
      {pendingShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 dark:shadow-black/30">
            <h2 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">
              Share as {pendingShare.toUpperCase()}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {shareError
                ? shareError
                : shareFiles
                  ? "Your receipt is ready."
                  : "Preparing your receipt..."}
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setPendingShare(null);
                  setShareError(null);
                }}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmShare}
                disabled={!shareFiles}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
              >
                {shareFiles ? "Share" : "..."}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden receipt for capture */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }} aria-hidden="true">
        <ReceiptView
          ref={receiptRef}
          entries={entries}
          members={members}
          showDescription={showDescription}
          subtotals={subtotals}
          totals={totals}
          grandSubtotal={grandSubtotal}
          grandTotal={grandTotal}
          taxValue={taxValue}
          deliveryValue={deliveryValue}
        />
      </div>
    </>
  );
}
