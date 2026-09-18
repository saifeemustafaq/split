import { calculate } from "./calc";
import type { BillSnapshot } from "./types";

function isBlankEntry(entry: BillSnapshot["entries"][number]): boolean {
  return entry.rawInput.trim() === "" && entry.description.trim() === "";
}

/**
 * Stable string form of a bill, used to tell whether the screen has changed
 * since it was last saved. Key order is fixed so it never depends on how the
 * object was built, and the trailing empty row is ignored so restoring a bill
 * does not immediately look edited.
 */
export function snapshotSignature(snapshot: BillSnapshot): string {
  return JSON.stringify({
    members: snapshot.members.map((m) => [m.id, m.name, m.initial]),
    entries: snapshot.entries.filter((e) => !isBlankEntry(e)).map((e) => [
      e.id,
      e.rawInput,
      e.cost,
      e.description,
      Object.keys(e.assignees)
        .filter((key) => e.assignees[key])
        .sort(),
    ]),
    showDescription: snapshot.showDescription,
    showTax: snapshot.showTax,
    showDelivery: snapshot.showDelivery,
    taxAmount: snapshot.taxAmount,
    deliveryAmount: snapshot.deliveryAmount,
  });
}

/** True when the bill has anything worth saving. */
export function hasContent(snapshot: BillSnapshot): boolean {
  return snapshot.entries.some((e) => e.cost > 0);
}

export function defaultBillName(snapshot: BillSnapshot, date = new Date()): string {
  const { grandTotal } = calculate(snapshot);
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${day} - $${grandTotal.toFixed(2)}`;
}

export function formatSavedAt(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
