"use client";

import type { Member } from "./ExpenseSplitter";

interface SummaryPanelProps {
  members: Member[];
  subtotals: Record<string, number>;
  totals: Record<string, number>;
  grandSubtotal: number;
  grandTotal: number;
  taxValue: number;
  deliveryValue: number;
}

export default function SummaryPanel({
  members,
  subtotals,
  totals,
  grandSubtotal,
  grandTotal,
  taxValue,
  deliveryValue,
}: SummaryPanelProps) {
  const hasExtras = taxValue > 0 || deliveryValue > 0;
  const hasAnyTotal = grandTotal > 0;

  if (members.length < 2) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <p className="text-center text-sm text-gray-400">
          Add members to see the split.
        </p>
      </div>
    );
  }

  if (!hasAnyTotal) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Split</h2>
        <p className="text-sm text-gray-400">
          Add items and assign members to see the split.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">Split</h2>

      <div className="space-y-2.5">
        {members.map((member) => {
          const sub = subtotals[member.id] || 0;
          const total = totals[member.id] || 0;
          const extra = total - sub;

          return (
            <div key={member.id} className="flex items-baseline justify-between">
              <span className="text-sm text-gray-600">{member.name}</span>
              <div className="text-right">
                {hasExtras && extra > 0 ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-gray-400">
                      {sub.toFixed(2)} + {extra.toFixed(2)}
                    </span>
                    <span className="text-sm font-semibold text-emerald-600">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-emerald-600">
                    ${total.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        {hasExtras && (
          <div className="mb-3 space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Subtotal</span>
              <span>${grandSubtotal.toFixed(2)}</span>
            </div>
            {taxValue > 0 && (
              <div className="flex justify-between text-xs text-gray-400">
                <span>Tax</span>
                <span>${taxValue.toFixed(2)}</span>
              </div>
            )}
            {deliveryValue > 0 && (
              <div className="flex justify-between text-xs text-gray-400">
                <span>Delivery</span>
                <span>${deliveryValue.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-900">Total</span>
          <span className="text-2xl font-bold text-gray-900">
            ${grandTotal.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
