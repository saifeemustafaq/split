"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearAllBills,
  deleteBill,
  duplicateBill,
  getStorageKind,
  listBills,
  renameBill,
  subscribeToBillChanges,
} from "../lib/bills";
import { calculate } from "../lib/calc";
import {
  captureReceipt,
  downloadExcel,
  downloadPdf,
  downloadPng,
} from "../lib/exporters";
import { formatSavedAt } from "../lib/snapshot";
import type { StorageKind } from "../lib/db";
import type { SavedBill } from "../lib/types";
import ReceiptView from "./ReceiptView";

type ExportFormat = "png" | "pdf" | "excel";

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
  currentBillId: string | null;
  hasUnsavedWork: boolean;
  onLoad: (bill: SavedBill) => void;
  onSaveCurrentAndLoad: (bill: SavedBill) => Promise<void>;
}

function fileNameFor(bill: SavedBill): string {
  const slug = bill.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `splitor-${slug || "receipt"}`;
}

export default function HistoryModal({
  open,
  onClose,
  currentBillId,
  hasUnsavedWork,
  onLoad,
  onSaveCurrentAndLoad,
}: HistoryModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const [bills, setBills] = useState<SavedBill[] | null>(null);
  const [storageKind, setStorageKind] = useState<StorageKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [exportMenuId, setExportMenuId] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState<{
    bill: SavedBill;
    format: ExportFormat;
  } | null>(null);
  const [pendingLoad, setPendingLoad] = useState<SavedBill | null>(null);
  const [savingBeforeLoad, setSavingBeforeLoad] = useState(false);

  const refresh = useCallback(async () => {
    const rows = await listBills();
    setBills(rows);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRenamingId(null);
    setConfirmDeleteId(null);
    setConfirmClear(false);
    setExportMenuId(null);
    setPendingLoad(null);
    refresh();
    getStorageKind().then(setStorageKind);
    return subscribeToBillChanges(refresh);
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pendingLoad) setPendingLoad(null);
      else onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose, pendingLoad]);

  // The hidden receipt is rendered first, then captured on the next commit.
  useEffect(() => {
    if (!exportTarget) return;
    let cancelled = false;

    (async () => {
      const { bill, format } = exportTarget;
      const calc = calculate(bill);
      const fileName = fileNameFor(bill);
      try {
        if (format === "excel") {
          await downloadExcel(
            bill.entries,
            bill.members,
            bill.showDescription,
            calc.taxValue,
            calc.deliveryValue,
            fileName
          );
        } else if (receiptRef.current) {
          const canvas = await captureReceipt(receiptRef.current);
          if (format === "png") await downloadPng(canvas, fileName);
          else await downloadPdf(canvas, fileName);
        }
      } catch {
        if (!cancelled) setError("Could not export this bill.");
      } finally {
        if (!cancelled) setExportTarget(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [exportTarget]);

  const runMutation = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
      await refresh();
    },
    [refresh]
  );

  const requestLoad = (bill: SavedBill) => {
    if (hasUnsavedWork) {
      setPendingLoad(bill);
      return;
    }
    onLoad(bill);
    onClose();
  };

  const confirmLoad = (bill: SavedBill) => {
    setPendingLoad(null);
    onLoad(bill);
    onClose();
  };

  const saveThenLoad = async (bill: SavedBill) => {
    setSavingBeforeLoad(true);
    try {
      await onSaveCurrentAndLoad(bill);
      setPendingLoad(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the current bill.");
    } finally {
      setSavingBeforeLoad(false);
    }
  };

  const submitRename = async (bill: SavedBill) => {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || name === bill.name) return;
    await runMutation(() => renameBill(bill.id, name));
  };

  if (!open) return null;

  const actionButton =
    "rounded px-1.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100";

  return (
    <>
      <div
        ref={backdropRef}
        onClick={(e) => {
          if (e.target === backdropRef.current) onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60"
      >
        <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl dark:bg-gray-800 dark:shadow-black/30">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Recent bills
            </h2>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="3" y1="3" x2="11" y2="11" />
                <line x1="11" y1="3" x2="3" y2="11" />
              </svg>
            </button>
          </div>

          {storageKind === "memory" && (
            <p className="border-b border-amber-100 bg-amber-50 px-6 py-2 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
              This browser is blocking storage, so bills saved now will be lost
              when you close the tab.
            </p>
          )}

          {error && (
            <p className="border-b border-red-100 bg-red-50 px-6 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {bills === null && (
              <p className="px-3 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                Loading...
              </p>
            )}

            {bills !== null && bills.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                No saved bills yet. Use Save to keep one here.
              </p>
            )}

            {bills?.map((bill) => {
              const memberNames = bill.members.map((m) => m.name).join(", ");
              const isCurrent = bill.id === currentBillId;

              return (
                <div
                  key={bill.id}
                  className={`rounded-md px-3 py-2.5 transition-colors ${
                    isCurrent
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {renamingId === bill.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => submitRename(bill)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              submitRename(bill);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              e.stopPropagation();
                              setRenamingId(null);
                            }
                          }}
                          className="h-7 w-full rounded border border-blue-600 bg-white px-2 text-sm text-gray-900 outline-none dark:bg-gray-900 dark:text-gray-100"
                        />
                      ) : (
                        <button
                          onClick={() => requestLoad(bill)}
                          className="block w-full truncate text-left text-sm font-medium text-gray-900 dark:text-gray-100"
                          title="Load this bill"
                        >
                          {bill.name}
                          {isCurrent && (
                            <span className="ml-1.5 text-xs font-normal text-blue-600 dark:text-blue-400">
                              open
                            </span>
                          )}
                        </button>
                      )}
                      <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                        {formatSavedAt(bill.updatedAt)} · {bill.itemCount}{" "}
                        {bill.itemCount === 1 ? "item" : "items"}
                        {memberNames && ` · ${memberNames}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                      ${bill.grandTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-0.5">
                    <button onClick={() => requestLoad(bill)} className={actionButton}>
                      Load
                    </button>

                    <div className="relative">
                      <button
                        onClick={() =>
                          setExportMenuId(exportMenuId === bill.id ? null : bill.id)
                        }
                        disabled={exportTarget !== null}
                        className={`${actionButton} disabled:opacity-40`}
                      >
                        {exportTarget?.bill.id === bill.id ? "Exporting..." : "Export"}
                      </button>
                      {exportMenuId === bill.id && (
                        <div className="absolute bottom-full left-0 z-10 mb-1 min-w-[100px] rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                          {(["png", "pdf", "excel"] as ExportFormat[]).map((format) => (
                            <button
                              key={format}
                              onClick={() => {
                                setExportMenuId(null);
                                setExportTarget({ bill, format });
                              }}
                              className="block w-full px-4 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                              as {format === "excel" ? "Excel" : format.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setRenameValue(bill.name);
                        setRenamingId(bill.id);
                      }}
                      className={actionButton}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => runMutation(() => duplicateBill(bill.id))}
                      className={actionButton}
                    >
                      Duplicate
                    </button>

                    {confirmDeleteId === bill.id ? (
                      <span className="flex items-center gap-0.5">
                        <button
                          onClick={async () => {
                            setConfirmDeleteId(null);
                            await runMutation(() => deleteBill(bill.id));
                          }}
                          className="rounded px-1.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                        >
                          Delete?
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className={actionButton}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(bill.id)}
                        className="rounded px-1.5 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {bills !== null && bills.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 dark:border-gray-700">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {bills.length} saved {bills.length === 1 ? "bill" : "bills"}
              </span>
              {confirmClear ? (
                <span className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setConfirmClear(false);
                      await runMutation(clearAllBills);
                    }}
                    className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
                  >
                    Delete everything
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className={actionButton}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="rounded-md px-2 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {pendingLoad && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/30 p-4 dark:bg-black/50">
              <div className="w-full max-w-xs rounded-lg bg-white p-5 shadow-xl dark:bg-gray-900">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Unsaved changes
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  The bill on screen has not been saved. Loading “{pendingLoad.name}”
                  will replace it.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => saveThenLoad(pendingLoad)}
                    disabled={savingBeforeLoad}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
                  >
                    {savingBeforeLoad ? "Saving..." : "Save current, then load"}
                  </button>
                  <button
                    onClick={() => confirmLoad(pendingLoad)}
                    disabled={savingBeforeLoad}
                    className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    Discard and load
                  </button>
                  <button
                    onClick={() => setPendingLoad(null)}
                    disabled={savingBeforeLoad}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden receipt used to export a bill straight from history */}
      {exportTarget && exportTarget.format !== "excel" && (
        <div style={{ position: "fixed", left: "-9999px", top: 0 }} aria-hidden="true">
          <ReceiptView
            ref={receiptRef}
            entries={exportTarget.bill.entries}
            members={exportTarget.bill.members}
            showDescription={exportTarget.bill.showDescription}
            date={new Date(exportTarget.bill.updatedAt)}
            {...calculate(exportTarget.bill)}
          />
        </div>
      )}
    </>
  );
}
