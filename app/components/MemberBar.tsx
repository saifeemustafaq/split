"use client";

import { useState, useRef } from "react";
import type { Member } from "./ExpenseSplitter";

interface MemberBarProps {
  members: Member[];
  onAdd: (name: string) => void;
  onRemove: (memberId: string) => void;
}

export default function MemberBar({ members, onAdd, onRemove }: MemberBarProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    onAdd(trimmed);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add member..."
          className="h-8 w-32 rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          onClick={handleSubmit}
          className="h-8 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
        >
          Add
        </button>
      </div>

      {members.map((member) => (
        <span
          key={member.id}
          className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-1 pr-1.5 pl-2.5 text-sm text-gray-700 dark:bg-gray-700 dark:text-gray-300"
        >
          {member.name}
          <button
            onClick={() => onRemove(member.id)}
            className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-600 dark:hover:text-gray-300"
            aria-label={`Remove ${member.name}`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="2" y1="2" x2="8" y2="8" />
              <line x1="8" y1="2" x2="2" y2="8" />
            </svg>
          </button>
        </span>
      ))}

      {members.length < 2 && (
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {members.length === 0
            ? "Add at least 2 members to start splitting"
            : "Add one more member"}
        </span>
      )}
    </div>
  );
}
