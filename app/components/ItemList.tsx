"use client";

import { useRef, useEffect, useCallback } from "react";
import type { Member, Entry } from "./ExpenseSplitter";
import ItemRow from "./ItemRow";

interface ItemListProps {
  entries: Entry[];
  members: Member[];
  showDescription: boolean;
  onUpdateEntry: (entryId: string, rawInput: string) => void;
  onDeleteEntry: (entryId: string) => void;
  onToggleAssignee: (entryId: string, memberId: string) => void;
  onUpdateDescription: (entryId: string, description: string) => void;
  onAddEntry: () => string;
}

export default function ItemList({
  entries,
  members,
  showDescription,
  onUpdateEntry,
  onDeleteEntry,
  onToggleAssignee,
  onUpdateDescription,
  onAddEntry,
}: ItemListProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const descRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pendingFocusIndex = useRef<number | null>(null);
  const pendingFocusTarget = useRef<"cost" | "desc">("cost");

  useEffect(() => {
    if (pendingFocusIndex.current !== null) {
      const idx = pendingFocusIndex.current;
      const target = pendingFocusTarget.current;
      pendingFocusIndex.current = null;
      pendingFocusTarget.current = "cost";
      requestAnimationFrame(() => {
        if (target === "desc" && descRefs.current[idx]) {
          descRefs.current[idx]?.focus();
        } else {
          inputRefs.current[idx]?.focus();
        }
      });
    }
  }, [entries.length]);

  const handleUpdate = useCallback(
    (entryId: string, rawInput: string) => {
      onUpdateEntry(entryId, rawInput);

      const lastEntry = entries[entries.length - 1];
      if (lastEntry && lastEntry.id === entryId && rawInput.trim() !== "") {
        onAddEntry();
      }
    },
    [entries, onUpdateEntry, onAddEntry]
  );

  const handleEnterKey = useCallback(
    (index: number) => {
      if (index < entries.length - 1) {
        inputRefs.current[index + 1]?.focus();
      } else {
        onAddEntry();
        pendingFocusIndex.current = entries.length;
        pendingFocusTarget.current = "cost";
      }
    },
    [entries.length, onAddEntry]
  );

  const handleDescEnterKey = useCallback(
    (index: number) => {
      if (index < entries.length - 1) {
        descRefs.current[index + 1]?.focus();
      } else {
        onAddEntry();
        pendingFocusIndex.current = entries.length;
        pendingFocusTarget.current = "desc";
      }
    },
    [entries.length, onAddEntry]
  );

  const setRef = useCallback(
    (index: number) => (el: HTMLInputElement | null) => {
      inputRefs.current[index] = el;
    },
    []
  );

  const setDescRef = useCallback(
    (index: number) => (el: HTMLInputElement | null) => {
      descRefs.current[index] = el;
    },
    []
  );

  if (members.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
        <p className="text-sm text-gray-400">
          Add at least 2 members above to start adding items.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, index) => (
        <ItemRow
          key={entry.id}
          ref={setRef(index)}
          descRef={setDescRef(index)}
          entry={entry}
          members={members}
          index={index}
          showDescription={showDescription}
          onUpdate={handleUpdate}
          onDelete={onDeleteEntry}
          onToggleAssignee={onToggleAssignee}
          onUpdateDescription={onUpdateDescription}
          onEnterKey={handleEnterKey}
          onDescEnterKey={handleDescEnterKey}
        />
      ))}
    </div>
  );
}
