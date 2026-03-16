"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Member, Entry } from "./ExpenseSplitter";

interface ExportMenuProps {
  entries: Entry[];
  members: Member[];
  showDescription: boolean;
  subtotals: Record<string, number>;
  totals: Record<string, number>;
  grandSubtotal: number;
  grandTotal: number;
  taxValue: number;
  deliveryValue: number;
}

type ExportFormat = "png" | "pdf";

async function captureReceipt(el: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default;
  return html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
  });
}

async function downloadPng(canvas: HTMLCanvasElement) {
  const link = document.createElement("a");
  link.download = "splitor-receipt.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function downloadPdf(canvas: HTMLCanvasElement) {
  const { jsPDF } = await import("jspdf");
  const imgData = canvas.toDataURL("image/png");
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  const pdfWidth = 210;
  const pdfImgWidth = pdfWidth - 20;
  const pdfImgHeight = (imgHeight * pdfImgWidth) / imgWidth;

  const pdf = new jsPDF({
    orientation: pdfImgHeight > 280 ? "portrait" : "portrait",
    unit: "mm",
    format: [pdfWidth, Math.max(pdfImgHeight + 20, 100)],
  });

  pdf.addImage(imgData, "PNG", 10, 10, pdfImgWidth, pdfImgHeight);
  pdf.save("splitor-receipt.pdf");
}

async function sharePng(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) return false;

  const file = new File([blob], "splitor-receipt.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "Splitor Receipt" });
    return true;
  }
  return false;
}

async function sharePdf(canvas: HTMLCanvasElement) {
  const { jsPDF } = await import("jspdf");
  const imgData = canvas.toDataURL("image/png");
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  const pdfWidth = 210;
  const pdfImgWidth = pdfWidth - 20;
  const pdfImgHeight = (imgHeight * pdfImgWidth) / imgWidth;

  const pdf = new jsPDF({
    unit: "mm",
    format: [pdfWidth, Math.max(pdfImgHeight + 20, 100)],
  });
  pdf.addImage(imgData, "PNG", 10, 10, pdfImgWidth, pdfImgHeight);

  const pdfBlob = pdf.output("blob");
  const file = new File([pdfBlob], "splitor-receipt.pdf", {
    type: "application/pdf",
  });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "Splitor Receipt" });
    return true;
  }
  return false;
}

export default function ExportMenu({
  entries,
  members,
  showDescription,
  subtotals,
  totals,
  grandSubtotal,
  grandTotal,
  taxValue,
  deliveryValue,
}: ExportMenuProps) {
  const [openMenu, setOpenMenu] = useState<"download" | "share" | null>(null);
  const [busy, setBusy] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasExtras = taxValue > 0 || deliveryValue > 0;
  const filledEntries = entries.filter((e) => e.cost > 0);
  const disabled = filledEntries.length === 0;

  useEffect(() => {
    if (!openMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMenu]);

  const handleExport = useCallback(
    async (action: "download" | "share", format: ExportFormat) => {
      if (!receiptRef.current || busy) return;
      setOpenMenu(null);
      setBusy(true);
      try {
        const canvas = await captureReceipt(receiptRef.current);
        if (action === "download") {
          if (format === "png") await downloadPng(canvas);
          else await downloadPdf(canvas);
        } else {
          let shared = false;
          if (format === "png") shared = await sharePng(canvas);
          else shared = await sharePdf(canvas);
          if (!shared) {
            if (format === "png") await downloadPng(canvas);
            else await downloadPdf(canvas);
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [busy]
  );

  const renderButtons = (isMobile: boolean) => (
    <div ref={!isMobile ? menuRef : undefined} className={`relative gap-2 ${isMobile ? "flex w-full" : "inline-flex"}`}>
      <button
        disabled={disabled || busy}
        onClick={() => setOpenMenu(openMenu === "download" ? null : "download")}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md bg-gray-900 px-3 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-gray-900 ${
          isMobile ? "flex-1 py-2.5" : "py-1.5"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {busy ? "..." : "Download"}
      </button>
      <button
        disabled={disabled || busy}
        onClick={() => setOpenMenu(openMenu === "share" ? null : "share")}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md bg-gray-900 px-3 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-gray-900 ${
          isMobile ? "flex-1 py-2.5" : "py-1.5"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        Share
      </button>
      <a
        href="https://www.linkedin.com/in/saifeemustafa/"
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-1.5 rounded-md bg-gray-900 px-3 text-xs font-medium text-white transition-colors hover:bg-gray-800 ${
          isMobile ? "flex-1 py-2.5" : "py-1.5"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        Contact
      </a>

      {openMenu && (
        <div
          className={`absolute z-50 rounded-md border border-gray-200 bg-white py-1 shadow-lg ${
            isMobile
              ? "bottom-full left-0 mb-1"
              : "top-full left-0 mt-1"
          }`}
        >
          <button
            onClick={() => handleExport(openMenu, "png")}
            className="block w-full px-4 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
          >
            as PNG
          </button>
          <button
            onClick={() => handleExport(openMenu, "pdf")}
            className="block w-full px-4 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
          >
            as PDF
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop inline buttons */}
      <div className="hidden md:block">{renderButtons(false)}</div>

      {/* Mobile fixed bottom bar */}
      <div
        ref={menuRef}
        className="fixed right-0 bottom-0 left-0 z-40 border-t border-gray-200 bg-white px-4 py-3 md:hidden"
      >
        <div className="mx-auto max-w-5xl">
          {renderButtons(true)}
        </div>
      </div>

      {/* Hidden receipt for capture */}
      <div
        style={{ position: "fixed", left: "-9999px", top: 0 }}
        aria-hidden="true"
      >
        <div
          ref={receiptRef}
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
            {new Date().toLocaleDateString("en-US", {
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
                  <tr
                    key={entry.id}
                    style={{ borderBottom: "1px solid #f3f4f6" }}
                  >
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
                      {assignedNames.length > 0
                        ? assignedNames.join(", ")
                        : "—"}
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
      </div>
    </>
  );
}
