"use client";

import { useState, useMemo, useCallback } from "react";
import MemberBar from "./MemberBar";
import ItemList from "./ItemList";
import ExtrasBar from "./ExtrasBar";
import SummaryPanel from "./SummaryPanel";

export interface Member {
  id: string;
  name: string;
  initial: string;
}

export interface Entry {
  id: string;
  rawInput: string;
  cost: number;
  description: string;
  assignees: Record<string, boolean>;
}

function createEmptyEntry(): Entry {
  return {
    id: crypto.randomUUID(),
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
  { id: "default-ad", name: "AD", initial: "a" },
  { id: "default-rs", name: "RS", initial: "r" },
];

export default function ExpenseSplitter() {
  const [members, setMembers] = useState<Member[]>(DEFAULT_MEMBERS);
  const [entries, setEntries] = useState<Entry[]>([createEmptyEntry()]);
  const [showDescription, setShowDescription] = useState(false);
  const [showTax, setShowTax] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);
  const [taxAmount, setTaxAmount] = useState("");
  const [deliveryAmount, setDeliveryAmount] = useState("");

  const addMember = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase()))
        return;

      const newMember: Member = {
        id: crypto.randomUUID(),
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

  const calculated = useMemo(() => {
    const subtotals: Record<string, number> = {};
    for (const m of members) {
      subtotals[m.id] = 0;
    }

    for (const entry of entries) {
      if (entry.cost <= 0) continue;
      const selected = members.filter((m) => entry.assignees[m.id]);
      if (selected.length === 0) continue;
      const share = entry.cost / selected.length;
      for (const m of selected) {
        subtotals[m.id] += share;
      }
    }

    const grandSubtotal = Object.values(subtotals).reduce(
      (sum, v) => sum + v,
      0
    );

    const taxValue =
      showTax && taxAmount.trim()
        ? Math.max(0, parseFloat(taxAmount) || 0)
        : 0;
    const deliveryValue =
      showDelivery && deliveryAmount.trim()
        ? Math.max(0, parseFloat(deliveryAmount) || 0)
        : 0;
    const extras = taxValue + deliveryValue;

    const totals: Record<string, number> = {};
    for (const m of members) {
      if (grandSubtotal > 0 && extras > 0) {
        const proportion = subtotals[m.id] / grandSubtotal;
        totals[m.id] = subtotals[m.id] + extras * proportion;
      } else {
        totals[m.id] = subtotals[m.id];
      }
    }

    const grandTotal = Object.values(totals).reduce((sum, v) => sum + v, 0);

    return {
      subtotals,
      totals,
      grandSubtotal,
      grandTotal,
      taxValue,
      deliveryValue,
    };
  }, [entries, members, taxAmount, deliveryAmount, showTax, showDelivery]);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-6">
          <h1 className="mb-4 text-lg font-semibold tracking-tight text-gray-900">
            MakSplit
          </h1>
          <MemberBar
            members={members}
            onAdd={addMember}
            onRemove={removeMember}
          />
          <button
            onClick={() => setShowDescription((prev) => !prev)}
            className={`mt-3 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              showDescription
                ? "bg-gray-900 text-white hover:bg-gray-800"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {showDescription ? "- Description" : "+ Description"}
          </button>
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
