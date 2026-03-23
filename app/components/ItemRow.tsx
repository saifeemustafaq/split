"use client";

import { forwardRef, useRef, useCallback } from "react";
import type { Member, Entry } from "./ExpenseSplitter";

interface ItemRowProps {
  entry: Entry;
  members: Member[];
  index: number;
  showDescription: boolean;
  onUpdate: (entryId: string, rawInput: string) => void;
  onDelete: (entryId: string) => void;
  onToggleAssignee: (entryId: string, memberId: string) => void;
  onUpdateDescription: (entryId: string, description: string) => void;
  onEnterKey: (index: number) => void;
  onDescEnterKey: (index: number) => void;
  descRef?: React.Ref<HTMLInputElement>;
}

const ItemRow = forwardRef<HTMLInputElement, ItemRowProps>(
  function ItemRow(
    { entry, members, index, showDescription, onUpdate, onDelete, onToggleAssignee, onUpdateDescription, onEnterKey, onDescEnterKey, descRef },
    ref
  ) {
    const costRef = useRef<HTMLInputElement | null>(null);

    const setCostRef = useCallback(
      (el: HTMLInputElement | null) => {
        costRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      },
      [ref]
    );

    const handleCostKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onEnterKey(index);
      }
    };

    const handleDescKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        costRef.current?.focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onDescEnterKey(index);
      }
    };

    return (
      <div className="group flex items-center gap-1.5 py-0.5">
        {showDescription && (
          <input
            ref={descRef}
            type="text"
            tabIndex={0}
            value={entry.description}
            onChange={(e) => onUpdateDescription(entry.id, e.target.value)}
            onKeyDown={handleDescKeyDown}
            placeholder="Description"
            className="h-9 w-32 shrink-0 rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-600 sm:w-40"
          />
        )}
        <div className="relative flex-1">
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-gray-300 dark:text-gray-600">
            $
          </span>
          <input
            ref={setCostRef}
            type="text"
            value={entry.rawInput}
            onChange={(e) => onUpdate(entry.id, e.target.value)}
            onKeyDown={handleCostKeyDown}
            placeholder={`Item ${index + 1}`}
            className="h-9 w-full rounded-md border border-gray-200 bg-white pr-2 pl-6 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-600"
          />
        </div>

        <div className="flex items-center gap-1">
          {members.map((member) => {
            const active = !!entry.assignees[member.id];
            return (
              <button
                key={member.id}
                tabIndex={-1}
                onClick={() => onToggleAssignee(entry.id, member.id)}
                className={`flex h-8 min-w-[32px] items-center justify-center rounded-full px-2 text-xs font-medium transition-colors ${
                  active
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:bg-gray-700 dark:text-gray-500 dark:hover:bg-gray-600 dark:hover:text-gray-300"
                }`}
                title={member.name}
              >
                {member.initial.toUpperCase()}
              </button>
            );
          })}
        </div>

        <button
          tabIndex={-1}
          onClick={() => onDelete(entry.id)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-300 transition-all hover:bg-red-50 hover:text-red-400 dark:text-gray-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
          aria-label="Delete row"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="3" y1="3" x2="11" y2="11" />
            <line x1="11" y1="3" x2="3" y2="11" />
          </svg>
        </button>
      </div>
    );
  }
);

export default ItemRow;
