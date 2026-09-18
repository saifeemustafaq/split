import type { Entry, Member } from "./types";

export type ExportFormat = "png" | "pdf";

/**
 * WebKit reads the blob URL after the click returns, so the anchor has to be in
 * the document and the URL has to outlive the current task.
 */
function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 10_000);
}

function colLetter(col: number): string {
  let s = "";
  let c = col;
  while (c > 0) {
    c--;
    s = String.fromCharCode(65 + (c % 26)) + s;
    c = Math.floor(c / 26);
  }
  return s;
}

export async function downloadExcel(
  entries: Entry[],
  members: Member[],
  showDescription: boolean,
  taxValue: number,
  deliveryValue: number,
  fileName = "splitor-receipt"
) {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Split");

  const filled = entries.filter((e) => e.cost > 0);
  if (filled.length === 0) return;

  const colCost = showDescription ? 3 : 2;
  const colAssignStart = colCost + 1;
  const colShareStart = colAssignStart + members.length + 1;
  const dataStartRow = 2;
  const dataEndRow = dataStartRow + filled.length - 1;

  // Headers
  const headers: string[] = ["#"];
  if (showDescription) headers.push("Description");
  headers.push("Cost");
  members.forEach((m) => headers.push(`${m.name} (assigned)`));
  headers.push("");
  members.forEach((m) => headers.push(`${m.name} (share)`));

  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "F3F4F6" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "D1D5DB" } },
    };
  });

  // Data rows
  filled.forEach((entry, i) => {
    const row: (string | number)[] = [i + 1];
    if (showDescription) row.push(entry.description || "");
    row.push(entry.cost);
    members.forEach((m) => row.push(entry.assignees[m.id] ? 1 : 0));
    row.push("");

    const excelRow = ws.addRow(row);
    const r = dataStartRow + i;

    // Share formula cells
    members.forEach((m, mi) => {
      const costCell = colLetter(colCost);
      const assignCell = colLetter(colAssignStart + mi);
      const assignRangeStart = colLetter(colAssignStart);
      const assignRangeEnd = colLetter(colAssignStart + members.length - 1);

      const shareCol = colShareStart + mi;
      const cell = excelRow.getCell(shareCol);
      cell.value = {
        formula: `IF(${assignCell}${r}>0,${costCell}${r}/SUM(${assignRangeStart}${r}:${assignRangeEnd}${r}),0)`,
        result: undefined,
      };
      cell.numFmt = "$#,##0.00";
    });

    // Format cost cell
    excelRow.getCell(colCost).numFmt = "$#,##0.00";
  });

  // Blank row
  ws.addRow([]);
  const summaryStartRow = dataEndRow + 2;

  // Subtotal row
  const subtotalRowData: (string | number)[] = [];
  subtotalRowData[0] = "Subtotal";
  const subtotalRow = ws.addRow(subtotalRowData);
  subtotalRow.font = { bold: true };

  members.forEach((_, mi) => {
    const shareColLtr = colLetter(colShareStart + mi);
    const cell = subtotalRow.getCell(colShareStart + mi);
    cell.value = {
      formula: `SUM(${shareColLtr}${dataStartRow}:${shareColLtr}${dataEndRow})`,
      result: undefined,
    };
    cell.numFmt = "$#,##0.00";
  });

  let currentRow = summaryStartRow;

  // Tax row
  if (taxValue > 0) {
    currentRow++;
    const taxRowData: (string | number)[] = [];
    taxRowData[0] = "Tax";
    const taxRow = ws.addRow(taxRowData);
    taxRow.getCell(colCost).value = taxValue;
    taxRow.getCell(colCost).numFmt = "$#,##0.00";

    const grandSubCol = colLetter(colShareStart);
    const grandSubEndCol = colLetter(colShareStart + members.length - 1);
    const grandSubFormula = `SUM(${grandSubCol}${summaryStartRow}:${grandSubEndCol}${summaryStartRow})`;

    members.forEach((_, mi) => {
      const shareColLtr = colLetter(colShareStart + mi);
      const cell = taxRow.getCell(colShareStart + mi);
      cell.value = {
        formula: `IF(${grandSubFormula}>0,${shareColLtr}${summaryStartRow}/${grandSubFormula}*${colLetter(colCost)}${currentRow},0)`,
        result: undefined,
      };
      cell.numFmt = "$#,##0.00";
    });
  }

  // Delivery row
  if (deliveryValue > 0) {
    currentRow++;
    const delRowData: (string | number)[] = [];
    delRowData[0] = "Delivery";
    const delRow = ws.addRow(delRowData);
    delRow.getCell(colCost).value = deliveryValue;
    delRow.getCell(colCost).numFmt = "$#,##0.00";

    const grandSubCol = colLetter(colShareStart);
    const grandSubEndCol = colLetter(colShareStart + members.length - 1);
    const grandSubFormula = `SUM(${grandSubCol}${summaryStartRow}:${grandSubEndCol}${summaryStartRow})`;

    members.forEach((_, mi) => {
      const shareColLtr = colLetter(colShareStart + mi);
      const cell = delRow.getCell(colShareStart + mi);
      cell.value = {
        formula: `IF(${grandSubFormula}>0,${shareColLtr}${summaryStartRow}/${grandSubFormula}*${colLetter(colCost)}${currentRow},0)`,
        result: undefined,
      };
      cell.numFmt = "$#,##0.00";
    });
  }

  // Total row
  currentRow++;
  const totalRowData: (string | number)[] = [];
  totalRowData[0] = "TOTAL";
  const totalRow = ws.addRow(totalRowData);
  totalRow.font = { bold: true, size: 12 };

  members.forEach((_, mi) => {
    const shareColLtr = colLetter(colShareStart + mi);
    const cell = totalRow.getCell(colShareStart + mi);
    cell.value = {
      formula: `SUM(${shareColLtr}${summaryStartRow}:${shareColLtr}${currentRow - 1})`,
      result: undefined,
    };
    cell.numFmt = "$#,##0.00";
    cell.font = { bold: true, size: 12 };
  });

  // Grand total row
  ws.addRow([]);
  const grandTotalRowData: (string | number)[] = [];
  grandTotalRowData[0] = "GRAND TOTAL";
  const grandTotalRow = ws.addRow(grandTotalRowData);
  grandTotalRow.font = { bold: true, size: 12 };

  const firstShareCol = colLetter(colShareStart);
  const lastShareCol = colLetter(colShareStart + members.length - 1);
  const grandTotalCell = grandTotalRow.getCell(colShareStart);
  grandTotalCell.value = {
    formula: `SUM(${firstShareCol}${currentRow}:${lastShareCol}${currentRow})`,
    result: undefined,
  };
  grandTotalCell.numFmt = "$#,##0.00";
  grandTotalCell.font = { bold: true, size: 12 };

  // Column widths
  ws.getColumn(1).width = 5;
  if (showDescription) ws.getColumn(2).width = 20;
  ws.getColumn(colCost).width = 12;
  for (let i = 0; i < members.length; i++) {
    ws.getColumn(colAssignStart + i).width = 14;
    ws.getColumn(colShareStart + i).width = 16;
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, `${fileName}.xlsx`);
}

export async function captureReceipt(el: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default;
  return html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
  });
}

export async function downloadPng(
  canvas: HTMLCanvasElement,
  fileName = "splitor-receipt"
) {
  const link = document.createElement("a");
  link.download = `${fileName}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function canvasToPdf(canvas: HTMLCanvasElement) {
  const imgData = canvas.toDataURL("image/png");
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  const pdfWidth = 210;
  const pdfImgWidth = pdfWidth - 20;
  const pdfImgHeight = (imgHeight * pdfImgWidth) / imgWidth;

  return { imgData, pdfWidth, pdfImgWidth, pdfImgHeight };
}

export async function downloadPdf(
  canvas: HTMLCanvasElement,
  fileName = "splitor-receipt"
) {
  const { jsPDF } = await import("jspdf");
  const { imgData, pdfWidth, pdfImgWidth, pdfImgHeight } = canvasToPdf(canvas);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pdfWidth, Math.max(pdfImgHeight + 20, 100)],
  });

  pdf.addImage(imgData, "PNG", 10, 10, pdfImgWidth, pdfImgHeight);
  pdf.save(`${fileName}.pdf`);
}

export type ShareFiles = Record<ExportFormat, File>;

/** Warms the export chunks so the first share doesn't wait on the network. */
export function prefetchExportModules() {
  void import("html2canvas");
  void import("jspdf");
}

/**
 * Builds both share payloads up front. Everything async about an export has to
 * happen before the tap that calls {@link shareFile}, so this is deliberately
 * separate from sharing.
 */
export async function buildShareFiles(
  el: HTMLElement,
  fileName = "splitor-receipt"
): Promise<ShareFiles> {
  const canvas = await captureReceipt(el);

  const pngBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!pngBlob) throw new Error("Could not render the receipt image.");

  const { jsPDF } = await import("jspdf");
  const { imgData, pdfWidth, pdfImgWidth, pdfImgHeight } = canvasToPdf(canvas);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pdfWidth, Math.max(pdfImgHeight + 20, 100)],
  });
  pdf.addImage(imgData, "PNG", 10, 10, pdfImgWidth, pdfImgHeight);

  return {
    png: new File([pngBlob], `${fileName}.png`, { type: "image/png" }),
    pdf: new File([pdf.output("blob")], `${fileName}.pdf`, {
      type: "application/pdf",
    }),
  };
}

/** True when the browser can put files into a native share sheet at all. */
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    const probe = new File([""], "probe.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Must be called synchronously from the tap handler. WebKit ties share
 * permission to the gesture being processed and drops it across any `await`,
 * so preparing the file here instead would reject with NotAllowedError.
 */
export function shareFile(file: File, title = "Splitor Receipt"): Promise<void> {
  if (!navigator.canShare?.({ files: [file] })) {
    return Promise.reject(new DOMException("Unsupported", "NotAllowedError"));
  }
  return navigator.share({ files: [file], title });
}

export function downloadFile(file: File) {
  triggerDownload(file, file.name);
}
