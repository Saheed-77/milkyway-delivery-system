/**
 * Table → PDF export. jsPDF is loaded on demand so it never weighs down the
 * initial bundle. Money must be passed through formatCurrencyPdf: the built-in
 * Helvetica font has no rupee glyph, so "₹" used to print as garbage.
 */
import { formatDateTime } from "./format";

export interface PdfColumn<Row> {
  header: string;
  value: (row: Row) => string | number | null | undefined;
  align?: "left" | "right";
}

interface PdfOptions {
  title: string;
  fileName: string;
  subtitle?: string;
  orientation?: "portrait" | "landscape";
  summary?: [string, string][];
}

const BRAND: [number, number, number] = [67, 115, 88];
const CREAM: [number, number, number] = [248, 247, 243];

export async function exportTablePdf<Row>(columns: PdfColumn<Row>[], rows: Row[], options: PdfOptions): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const { title, fileName, subtitle, orientation = "portrait", summary } = options;

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const margin = 14;

  // header band
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, width, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("MilkyWay", margin, 11.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated ${formatDateTime(new Date())}`, width - margin, 11.5, { align: "right" });

  doc.setTextColor(27, 42, 34);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, margin, 30);

  let y = 36;
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 100, 95);
    const lines = doc.splitTextToSize(subtitle, width - margin * 2) as string[]; // wrap instead of running off the page
    doc.text(lines, margin, y);
    y += lines.length * 5;
  }

  if (summary?.length) {
    y += 2;
    doc.setFontSize(9);
    const colW = (width - margin * 2) / summary.length;
    summary.forEach(([label, value], i) => {
      const x = margin + i * colW;
      doc.setFillColor(...CREAM);
      doc.roundedRect(x, y, colW - 3, 14, 2, 2, "F");
      doc.setTextColor(90, 100, 95);
      doc.setFont("helvetica", "normal");
      doc.text(label, x + 3, y + 5);
      doc.setTextColor(27, 42, 34);
      doc.setFont("helvetica", "bold");
      doc.text(value, x + 3, y + 11);
    });
    y += 18;
  }

  autoTable(doc, {
    startY: y + 2,
    margin: { left: margin, right: margin },
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => {
      const v = c.value(r);
      return v === null || v === undefined ? "—" : String(v);
    })),
    styles: { fontSize: 9, cellPadding: 2.6, textColor: [27, 42, 34] },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: CREAM },
    columnStyles: Object.fromEntries(columns.map((c, i) => [i, { halign: c.align ?? "left" }])),
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 125);
    const h = doc.internal.pageSize.getHeight();
    doc.text("MilkyWay · farm-fresh milk, delivered", margin, h - 8);
    doc.text(`Page ${i} of ${pages}`, width - margin, h - 8, { align: "right" });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`${fileName}-${stamp}.pdf`);
}
