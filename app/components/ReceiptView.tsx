"use client";

import { forwardRef } from "react";
import type { Entry, Member } from "../lib/types";

interface ReceiptViewProps {
  entries: Entry[];
  members: Member[];
  showDescription: boolean;
  subtotals: Record<string, number>;
  totals: Record<string, number>;
  grandSubtotal: number;
  grandTotal: number;
  taxValue: number;
  deliveryValue: number;
  date?: Date;
}

/**
 * The printable receipt. Rendered offscreen and captured by html2canvas, so it
 * uses inline styles rather than Tailwind classes.
 */
const ReceiptView = forwardRef<HTMLDivElement, ReceiptViewProps>(
  function ReceiptView(
    {
      entries,
      members,
      showDescription,
      subtotals,
      totals,
      grandSubtotal,
      grandTotal,
      taxValue,
      deliveryValue,
      date,
    },
    ref
  ) {
    const hasExtras = taxValue > 0 || deliveryValue > 0;
    const filledEntries = entries.filter((e) => e.cost > 0);

    return (
      <div
        ref={ref}
        style={{
          width: 520,
          padding: 32,
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 13,
          color: "#111827",
          backgroundColor: "#ffffff",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          Splitor
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 20 }}>
          {(date ?? new Date()).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>

        {/* Items table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: 20,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "2px solid #e5e7eb",
                textAlign: "left",
              }}
            >
              <th style={{ padding: "6px 8px 6px 0", fontWeight: 600 }}>#</th>
              {showDescription && (
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Item</th>
              )}
              <th
                style={{
                  padding: "6px 8px",
                  fontWeight: 600,
                  textAlign: "right",
                }}
              >
                Cost
              </th>
              <th style={{ padding: "6px 0 6px 8px", fontWeight: 600 }}>
                Split between
              </th>
            </tr>
          </thead>
          <tbody>
            {filledEntries.map((entry, i) => {
              const assignedNames = members
                .filter((m) => entry.assignees[m.id])
                .map((m) => m.name);
              return (
                <tr key={entry.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td
                    style={{
                      padding: "6px 8px 6px 0",
                      color: "#9ca3af",
                    }}
                  >
                    {i + 1}
                  </td>
                  {showDescription && (
                    <td style={{ padding: "6px 8px" }}>
                      {entry.description || "—"}
                    </td>
                  )}
                  <td
                    style={{
                      padding: "6px 8px",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ${entry.cost.toFixed(2)}
                  </td>
                  <td style={{ padding: "6px 0 6px 8px", color: "#6b7280" }}>
                    {assignedNames.length > 0 ? assignedNames.join(", ") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Divider */}
        <div
          style={{
            borderTop: "2px solid #e5e7eb",
            paddingTop: 16,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            Per-person split
          </div>
          {members.map((member) => {
            const sub = subtotals[member.id] || 0;
            const total = totals[member.id] || 0;
            if (total === 0) return null;
            const extra = total - sub;
            return (
              <div
                key={member.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                }}
              >
                <span>{member.name}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {hasExtras && extra > 0
                    ? `$${sub.toFixed(2)} + $${extra.toFixed(2)} = $${total.toFixed(2)}`
                    : `$${total.toFixed(2)}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            paddingTop: 12,
          }}
        >
          {hasExtras && (
            <div style={{ marginBottom: 8, color: "#6b7280", fontSize: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "2px 0",
                }}
              >
                <span>Subtotal</span>
                <span>${grandSubtotal.toFixed(2)}</span>
              </div>
              {taxValue > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px 0",
                  }}
                >
                  <span>Tax</span>
                  <span>${taxValue.toFixed(2)}</span>
                </div>
              )}
              {deliveryValue > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px 0",
                  }}
                >
                  <span>Delivery</span>
                  <span>${deliveryValue.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            <span>Total</span>
            <span>${grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  }
);

export default ReceiptView;
