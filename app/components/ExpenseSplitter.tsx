"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import MemberBar from "./MemberBar";
import ItemList from "./ItemList";
import ExtrasBar from "./ExtrasBar";
import SummaryPanel from "./SummaryPanel";
import ExportMenu from "./ExportMenu";
import HowToUseModal from "./HowToUseModal";
import HistoryModal from "./HistoryModal";
import SaveBillModal, { type SaveMode } from "./SaveBillModal";
import ThemeToggle from "./ThemeToggle";
import { useBillStorage, type HydrationResult } from "../hooks/useBillStorage";
import { createBill, updateBill } from "../lib/bills";
import { calculate } from "../lib/calc";
import { newId } from "../lib/id";
import { defaultBillName, hasContent, snapshotSignature } from "../lib/snapshot";
import type { BillSnapshot, Member, Entry, SavedBill } from "../lib/types";

export type { Member, Entry } from "../lib/types";

function createEmptyEntry(): Entry {
  return {
    id: newId(),
    rawInput: "",
    cost: 0,
    description: "",
    assignees: {},
  };
}

function parseInput(
  raw: string,
  members: Member[]
): { cost: number; assignees: Record<string, boolean> | null } {
  const letters = raw.replace(/[^a-zA-Z]/g, "").toLowerCase();
  const numStr = raw.replace(/[^0-9.]/g, "");
  const cost = parseFloat(numStr) || 0;

  if (letters.length === 0) {
    return { cost, assignees: null };
  }

  const assignees: Record<string, boolean> = {};
  for (const m of members) {
    assignees[m.id] = letters.includes(m.initial);
  }
  return { cost, assignees };
}

const DEFAULT_MEMBERS: Member[] = [
  { id: "default-ms", name: "MS", initial: "m" },
];

/** Signature of an untouched screen, used to detect whether the user started
 *  working before the stored draft finished loading. */
const PRISTINE_SIGNATURE = snapshotSignature({
  members: DEFAULT_MEMBERS,
  entries: [],
  showDescription: false,
  showTax: false,
  showDelivery: false,
  taxAmount: "",
  deliveryAmount: "",
});

export default function ExpenseSplitter() {
  const [members, setMembers] = useState<Member[]>(DEFAULT_MEMBERS);
  const [entries, setEntries] = useState<Entry[]>([createEmptyEntry()]);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showTax, setShowTax] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);
  const [taxAmount, setTaxAmount] = useState("");
  const [deliveryAmount, setDeliveryAmount] = useState("");

  const [showSave, setShowSave] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentBillId, setCurrentBillId] = useState<string | null>(null);
  const [currentBillName, setCurrentBillName] = useState<string | null>(null);

  const snapshot = useMemo<BillSnapshot>(
    () => ({
      members,
      entries,
      showDescription,
      showTax,
      showDelivery,
      taxAmount,
      deliveryAmount,
    }),
    [members, entries, showDescription, showTax, showDelivery, taxAmount, deliveryAmount]
  );

  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const applySnapshot = useCallback((next: BillSnapshot) => {
    setMembers(next.members);
    setEntries(next.entries.length > 0 ? next.entries : [createEmptyEntry()]);
    setShowDescription(next.showDescription);
    setShowTax(next.showTax);
    setShowDelivery(next.showDelivery);
    setTaxAmount(next.taxAmount);
    setDeliveryAmount(next.deliveryAmount);
  }, []);

  const handleHydrate = useCallback(
    ({ draft, members: storedMembers }: HydrationResult) => {
      // Never overwrite work the user started while the read was in flight.
      if (snapshotSignature(snapshotRef.current) !== PRISTINE_SIGNATURE) return false;

      if (draft) {
        applySnapshot(draft.snapshot);
        setCurrentBillId(draft.billId);
        setCurrentBillName(draft.billName);
        return true;
      }
      if (storedMembers && storedMembers.length > 0) {
        setMembers(storedMembers);
        return true;
      }
      return false;
    },
    [applySnapshot]
  );

  const storage = useBillStorage({
    snapshot,
    billId: currentBillId,
    billName: currentBillName,
    onHydrate: handleHydrate,
  });

  const { markSaved } = storage;

  const addMember = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase()))
        return;

      const newMember: Member = {
        id: newId(),
        name: trimmed,
        initial: trimmed[0].toLowerCase(),
      };
      setMembers((prev) => [...prev, newMember]);
    },
    [members]
  );

  const removeMember = useCallback((memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setEntries((prev) =>
      prev.map((entry) => {
        const { [memberId]: _, ...rest } = entry.assignees;
        return { ...entry, assignees: rest };
      })
    );
  }, []);

  const updateEntry = useCallback(
    (entryId: string, rawInput: string) => {
      const { cost, assignees } = parseInput(rawInput, members);
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== entryId) return e;
          const newAssignees =
            assignees !== null ? { ...e.assignees, ...assignees } : e.assignees;
          return { ...e, rawInput, cost, assignees: newAssignees };
        })
      );
    },
    [members]
  );

  const deleteEntry = useCallback((entryId: string) => {
    setEntries((prev) => {
      const filtered = prev.filter((e) => e.id !== entryId);
      return filtered.length === 0 ? [createEmptyEntry()] : filtered;
    });
  }, []);

  const toggleAssignee = useCallback(
    (entryId: string, memberId: string) => {
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== entryId) return e;
          return {
            ...e,
            assignees: {
              ...e.assignees,
              [memberId]: !e.assignees[memberId],
            },
          };
        })
      );
    },
    []
  );

  const updateDescription = useCallback(
    (entryId: string, description: string) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, description } : e))
      );
    },
    []
  );

  const addEntry = useCallback(() => {
    const newEntry = createEmptyEntry();
    setEntries((prev) => [...prev, newEntry]);
    return newEntry.id;
  }, []);

  const toggleTax = useCallback(() => {
    setShowTax((prev) => {
      if (prev) setTaxAmount("");
      return !prev;
    });
  }, []);

  const toggleDelivery = useCallback(() => {
    setShowDelivery((prev) => {
      if (prev) setDeliveryAmount("");
      return !prev;
    });
  }, []);

  const calculated = useMemo(() => calculate(snapshot), [snapshot]);

  const saveable = hasContent(snapshot);
  const hasUnsavedWork = saveable && storage.isDirty;

  const handleSave = useCallback(
    async (name: string, mode: SaveMode) => {
      const current = snapshotRef.current;
      const saved =
        mode === "update" && currentBillId
          ? await updateBill(currentBillId, current, name)
          : await createBill(name, current);

      setCurrentBillId(saved.id);
      setCurrentBillName(saved.name);
      markSaved(current);
      setShowSave(false);
    },
    [currentBillId, markSaved]
  );

  const loadBill = useCallback(
    (bill: SavedBill) => {
      applySnapshot(bill);
      setCurrentBillId(bill.id);
      setCurrentBillName(bill.name);
      markSaved(bill);
    },
    [applySnapshot, markSaved]
  );

  const saveCurrentAndLoad = useCallback(
    async (bill: SavedBill) => {
      const current = snapshotRef.current;
      const name = currentBillName ?? defaultBillName(current);
      if (currentBillId) await updateBill(currentBillId, current, name);
      else await createBill(name, current);
      loadBill(bill);
    },
    [currentBillId, currentBillName, loadBill]
  );

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-0">
      <HowToUseModal open={showHowTo} onClose={() => setShowHowTo(false)} />
      {showSave && (
        <SaveBillModal
          defaultName={defaultBillName(snapshot)}
          currentBillName={currentBillName}
          onClose={() => setShowSave(false)}
          onSave={handleSave}
        />
      )}
      <HistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        currentBillId={currentBillId}
        hasUnsavedWork={hasUnsavedWork}
        onLoad={loadBill}
        onSaveCurrentAndLoad={saveCurrentAndLoad}
      />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-6">
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={() => setShowHowTo(true)}
              className="group flex items-center gap-1.5"
            >
              <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Splitor
              </h1>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-500 transition-colors group-hover:bg-gray-900 group-hover:text-white dark:bg-gray-700 dark:text-gray-400 dark:group-hover:bg-white dark:group-hover:text-gray-900">
                ?
              </span>
            </button>
            <ThemeToggle />
            {currentBillName && (
              <span className="ml-1 truncate text-xs text-gray-400 dark:text-gray-500">
                {currentBillName}
                {hasUnsavedWork && " •"}
              </span>
            )}
          </div>
          <MemberBar
            members={members}
            onAdd={addMember}
            onRemove={removeMember}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowDescription((prev) => !prev)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                showDescription
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
              }`}
            >
              {showDescription ? "- Description" : "+ Description"}
            </button>
            <div className="ml-auto">
              <ExportMenu
                entries={entries}
                members={members}
                showDescription={showDescription}
                subtotals={calculated.subtotals}
                totals={calculated.totals}
                grandSubtotal={calculated.grandSubtotal}
                grandTotal={calculated.grandTotal}
                taxValue={calculated.taxValue}
                deliveryValue={calculated.deliveryValue}
                onSave={() => setShowSave(true)}
                onOpenHistory={() => setShowHistory(true)}
                canSave={saveable}
                isDirty={storage.isDirty}
              />
            </div>
          </div>
          {storage.writeError && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <span>{storage.writeError}</span>
              <button
                onClick={storage.dismissWriteError}
                className="shrink-0 font-medium underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </header>

        <div className="flex flex-col gap-6 md:flex-row">
          <div className="order-2 min-w-0 flex-1 md:order-1">
            <ItemList
              entries={entries}
              members={members}
              showDescription={showDescription}
              onUpdateEntry={updateEntry}
              onDeleteEntry={deleteEntry}
              onToggleAssignee={toggleAssignee}
              onUpdateDescription={updateDescription}
              onAddEntry={addEntry}
            />
            <ExtrasBar
              showTax={showTax}
              showDelivery={showDelivery}
              taxAmount={taxAmount}
              deliveryAmount={deliveryAmount}
              onToggleTax={toggleTax}
              onToggleDelivery={toggleDelivery}
              onTaxChange={setTaxAmount}
              onDeliveryChange={setDeliveryAmount}
            />
          </div>

          <div className="order-1 w-full shrink-0 md:sticky md:top-6 md:order-2 md:w-72 md:self-start">
            <SummaryPanel
              members={members}
              subtotals={calculated.subtotals}
              totals={calculated.totals}
              grandSubtotal={calculated.grandSubtotal}
              grandTotal={calculated.grandTotal}
              taxValue={calculated.taxValue}
              deliveryValue={calculated.deliveryValue}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
