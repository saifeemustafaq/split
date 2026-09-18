import type { BillSnapshot } from "./types";

export interface Calculated {
  subtotals: Record<string, number>;
  totals: Record<string, number>;
  grandSubtotal: number;
  grandTotal: number;
  taxValue: number;
  deliveryValue: number;
}

export type CalcInput = Pick<
  BillSnapshot,
  "members" | "entries" | "showTax" | "showDelivery" | "taxAmount" | "deliveryAmount"
>;

export function calculate({
  members,
  entries,
  showTax,
  showDelivery,
  taxAmount,
  deliveryAmount,
}: CalcInput): Calculated {
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

  const grandSubtotal = Object.values(subtotals).reduce((sum, v) => sum + v, 0);

  const taxValue =
    showTax && taxAmount.trim() ? Math.max(0, parseFloat(taxAmount) || 0) : 0;
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
}
