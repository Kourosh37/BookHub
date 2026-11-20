import { toPersianDigits } from "@/features/dashboard/utils/dashboard-utils";
export type ExportRow = {
  schedule: string;
  name: string;
  phone: string;
  time: string;
};
export type ExportContext = { title: string; stamp: string; count: number };
function getExportFileStamp(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}-${h}${min}`;
}

function splitTextToLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const normalized = String(text || "-");
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : ["-"];
}

async function renderExportCanvas(rows: ExportRow[], context: ExportContext) {
  const now = new Date();

  if (typeof document !== "undefined" && "fonts" in document) {
    await Promise.allSettled([
      document.fonts.load("400 12px Vazirmatn"),
      document.fonts.load("700 18px Vazirmatn"),
    ]);
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_CONTEXT_FAILED");

  const padding = 24;
  const tableTop = 108;
  const headerHeight = 34;
  const lineHeight = 18;
  const cellPad = 8;
  const cols = [
    { key: "schedule", label: "برنامه", width: 270 },
    { key: "name", label: "رزروکننده", width: 220 },
    { key: "phone", label: "شماره", width: 170 },
    { key: "time", label: "زمان", width: 280 },
  ] as const;
  const tableWidth = cols.reduce((sum, c) => sum + c.width, 0);
  const baseWidth = padding * 2 + tableWidth;

  ctx.font = '12px "Vazirmatn", Tahoma, sans-serif';
  const rowHeights = rows.map((row) => {
    const maxLines = Math.max(
      ...cols.map(
        (col) =>
          splitTextToLines(ctx, String(row[col.key]), col.width - cellPad * 2)
            .length,
      ),
    );
    return Math.max(30, maxLines * lineHeight + cellPad * 2);
  });
  const tableHeight = headerHeight + rowHeights.reduce((sum, h) => sum + h, 0);
  const baseHeight = tableTop + tableHeight + padding;

  canvas.width = baseWidth * 2;
  canvas.height = baseHeight * 2;
  ctx.scale(2, 2);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, baseWidth, baseHeight);

  ctx.direction = "rtl";
  ctx.textAlign = "right";

  ctx.fillStyle = "#0f172a";
  ctx.font = '700 22px "Vazirmatn", Tahoma, sans-serif';
  ctx.fillText("گزارش رزروها", baseWidth - padding, 40);
  ctx.fillStyle = "#475569";
  ctx.font = '400 12px "Vazirmatn", Tahoma, sans-serif';
  ctx.fillText(
    `${context.title} · ${context.count} رزرو`,
    baseWidth - padding,
    64,
  );
  ctx.fillText(`زمان خروجی: ${context.stamp}`, baseWidth - padding, 84);

  let y = tableTop;
  let x = padding;
  ctx.strokeStyle = "#cbd5e1";
  ctx.fillStyle = "#f1f5f9";
  ctx.lineWidth = 1;
  cols.forEach((col) => {
    ctx.fillRect(x, y, col.width, headerHeight);
    ctx.strokeRect(x, y, col.width, headerHeight);
    ctx.fillStyle = "#1e293b";
    ctx.font = '700 12px "Vazirmatn", Tahoma, sans-serif';
    ctx.fillText(col.label, x + col.width - cellPad, y + 22);
    ctx.fillStyle = "#f1f5f9";
    x += col.width;
  });
  y += headerHeight;

  rows.forEach((row, idx) => {
    const rowHeight = rowHeights[idx];
    let rowX = padding;
    cols.forEach((col) => {
      ctx.fillStyle = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
      ctx.fillRect(rowX, y, col.width, rowHeight);
      ctx.strokeStyle = "#e2e8f0";
      ctx.strokeRect(rowX, y, col.width, rowHeight);
      const lines = splitTextToLines(
        ctx,
        String(row[col.key]),
        col.width - cellPad * 2,
      );
      ctx.fillStyle = "#0f172a";
      ctx.font = '400 12px "Vazirmatn", Tahoma, sans-serif';
      lines.forEach((line, lineIdx) => {
        ctx.fillText(
          line,
          rowX + col.width - cellPad,
          y + cellPad + 14 + lineIdx * lineHeight,
        );
      });
      rowX += col.width;
    });
    y += rowHeight;
  });

  return { canvas, now };
}

export async function downloadBookingsImage(
  rows: ExportRow[],
  context: ExportContext,
) {
  const { canvas, now } = await renderExportCanvas(rows, context);
  const dataUrl = canvas.toDataURL("image/png");
  const fileStamp = getExportFileStamp(now);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `bookings-${fileStamp}.png`;
  link.click();
}

export async function downloadBookingsPdf(
  rows: ExportRow[],
  context: ExportContext,
) {
  const now = new Date();

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.setProperties({
    title: "گزارش رزروها",
    subject: "Bookings Export",
    author: "BookHub",
    creator: "BookHub Dashboard",
  });

  const fontRes = await fetch("/fonts/Vazirmatn-Regular.ttf");
  if (!fontRes.ok) throw new Error("PDF_FONT_LOAD_FAILED");
  const fontBuffer = await fontRes.arrayBuffer();
  const fontBytes = new Uint8Array(fontBuffer);
  let fontBinary = "";
  fontBytes.forEach((byte) => {
    fontBinary += String.fromCharCode(byte);
  });
  doc.addFileToVFS("Vazirmatn-Regular.ttf", btoa(fontBinary));
  doc.addFont("Vazirmatn-Regular.ttf", "Vazirmatn", "normal");
  doc.setFont("Vazirmatn", "normal");
  doc.setR2L(false);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 36;
  const marginTop = 32;
  const marginBottom = 42;
  const contentWidth = pageWidth - marginX * 2;
  const tableBottom = pageHeight - marginBottom;
  const cellPad = 7;
  const lineHeight = 15;
  const headerHeight = 30;
  const columns = [
    { key: "schedule", label: "برنامه", width: 185 },
    { key: "name", label: "رزروکننده", width: 120 },
    { key: "phone", label: "شماره", width: 92 },
    { key: "time", label: "زمان", width: contentWidth - 185 - 120 - 92 },
  ] as const;

  const preparePdfText = (value: string) => {
    return String(value || "-");
  };

  const asLines = (value: string, width: number) => {
    doc.setFontSize(10);
    const split = doc.splitTextToSize(
      String(value || "-"),
      width - cellPad * 2,
    );
    return (Array.isArray(split) ? split : [split]).map((line) =>
      String(line || "-"),
    );
  };

  const drawHeader = (startY: number) => {
    let right = marginX + contentWidth;
    doc.setLineWidth(0.7);
    columns.forEach((col) => {
      const x = right - col.width;
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.rect(x, startY, col.width, headerHeight, "FD");
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10.5);
      doc.text(
        preparePdfText(col.label),
        x + col.width - cellPad,
        startY + 19,
        { align: "right" },
      );
      right = x;
    });
  };

  const addReportHeader = () => {
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.text(preparePdfText("گزارش رزروها"), pageWidth - marginX, marginTop, {
      align: "right",
    });
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.text(
      preparePdfText(
        `${context.title} · ${toPersianDigits(String(context.count))} رزرو`,
      ),
      pageWidth - marginX,
      marginTop + 22,
      { align: "right" },
    );
    doc.text(
      preparePdfText(`زمان خروجی: ${context.stamp}`),
      pageWidth - marginX,
      marginTop + 40,
      { align: "right" },
    );
  };

  const addTablePage = (startY: number) => {
    doc.addPage();
    drawHeader(startY);
    return startY + headerHeight;
  };

  addReportHeader();
  let y = marginTop + 64;
  drawHeader(y);
  y += headerHeight;

  rows.forEach((row, rowIndex) => {
    const rowLines = columns.map((col) =>
      asLines(String(row[col.key]), col.width),
    );
    const rowHeight = Math.max(
      30,
      Math.max(...rowLines.map((lines) => lines.length)) * lineHeight +
        cellPad * 2,
    );
    if (y + rowHeight > tableBottom) {
      y = addTablePage(marginTop);
    }

    let right = marginX + contentWidth;
    columns.forEach((col, colIndex) => {
      const x = right - col.width;
      doc.setFillColor(
        rowIndex % 2 === 0 ? 255 : 248,
        rowIndex % 2 === 0 ? 255 : 250,
        rowIndex % 2 === 0 ? 255 : 252,
      );
      doc.setDrawColor(226, 232, 240);
      doc.rect(x, y, col.width, rowHeight, "FD");
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      rowLines[colIndex].forEach((line, lineIndex) => {
        doc.text(
          preparePdfText(line),
          x + col.width - cellPad,
          y + cellPad + 11 + lineIndex * lineHeight,
          { align: "right" },
        );
      });
      right = x;
    });
    y += rowHeight;
  });

  if (rows.length === 0) {
    const rowHeight = 34;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginX, y, contentWidth, rowHeight, "FD");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(10);
    doc.text(
      preparePdfText("رزروی برای خروجی وجود ندارد."),
      pageWidth - marginX - cellPad,
      y + 21,
      { align: "right" },
    );
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont("Vazirmatn", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      preparePdfText(
        `صفحه ${toPersianDigits(String(i))} از ${toPersianDigits(String(pageCount))}`,
      ),
      pageWidth / 2,
      pageHeight - 18,
      { align: "center" },
    );
  }

  const fileStamp = getExportFileStamp(now);
  doc.save(`bookings-${fileStamp}.pdf`);
}
