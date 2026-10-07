import PDFDocument from 'pdfkit';
import {
  BRAND,
  ZEBRA,
  GRID,
  TEXT_MAIN,
  TEXT_MUTED,
  KPI_BG,
  formatCop,
  formatVes,
  formatDateTime,
  collectPdf,
} from '../report/report-export.util';

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pagada',
  pending: 'Pendiente',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  paid: '#16a34a',
  pending: '#d97706',
  cancelled: '#dc2626',
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  credit: 'Crédito',
};

const PAD_X = 5;
const ROW_HEIGHT = 18;
const LINE_HEIGHT = 10;

export interface InvoicePdfItem {
  productName: string;
  size?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface InvoicePdfSale {
  saleNumber?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  items: InvoicePdfItem[];
}

export interface InvoicePdfData {
  invoiceNumber: string;
  date: Date | string;
  status: string;
  taxRate?: number;
  cancelledReason?: string | null;
  clientName: string;
  clientDocument: string;
  clientAddress: string;
  subtotal: number;
  tax: number;
  total: number;
  totalVes?: number | null;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Genera el PDF de una factura individual (encabezado de marca, datos del
 * cliente, detalle de líneas, totales y notas). Reutiliza los helpers visuales
 * de `report-export.util.ts` para mantener la identidad de los reportes.
 */
export function invoiceToPdf(
  data: InvoicePdfData,
  sale: InvoicePdfSale,
  companyName?: string,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 40,
    bufferPages: true,
  });

  const startX = doc.page.margins.left;
  const pageWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const right = startX + pageWidth;
  const footerY = doc.page.height - doc.page.margins.bottom - 36;
  const contentBottom = footerY - 14;
  const top = doc.page.margins.top;
  const date = data.date instanceof Date ? data.date : new Date(data.date);

  const statusLabel = STATUS_LABELS[data.status] ?? data.status;
  const statusColor = STATUS_COLORS[data.status] ?? TEXT_MUTED;

  const newPage = () => {
    doc.addPage();
    return doc.page.margins.top + 10;
  };

  // ---------------- Encabezado ----------------
  doc.rect(startX, top, pageWidth, 4).fill(BRAND);
  doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(10);
  doc.text('ZettaStock', startX, top + 10);
  doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8);
  doc.text(`Generado: ${formatDateTime(new Date())}`, startX, top + 14, {
    width: pageWidth,
    align: 'right',
  });

  let y = top + 26;
  if (companyName) {
    doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(14);
    doc.text(companyName, startX, y, { width: pageWidth, align: 'center' });
    y += 20;
  }

  doc.fillColor(TEXT_MAIN).font('Helvetica-Bold').fontSize(20);
  doc.text('FACTURA', startX, y, { width: pageWidth, align: 'center' });
  y += 24;

  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(13);
  doc.text(data.invoiceNumber, startX, y, {
    width: pageWidth,
    align: 'center',
  });
  y += 22;

  doc.font('Helvetica-Bold').fontSize(8);
  const badgeWidth = doc.widthOfString(statusLabel) + 20;
  const badgeX = startX + (pageWidth - badgeWidth) / 2;
  doc.roundedRect(badgeX, y, badgeWidth, 16, 8).fill(statusColor);
  doc.fillColor('#ffffff');
  doc.text(statusLabel, badgeX, y + 4, {
    width: badgeWidth,
    align: 'center',
    lineBreak: false,
  });
  y += 16 + 14;

  doc
    .strokeColor(GRID)
    .lineWidth(1)
    .moveTo(startX, y)
    .lineTo(right, y)
    .stroke();
  y += 16;

  // ---------------- Cliente + datos de la venta ----------------
  const colGap = 20;
  const leftW = pageWidth * 0.56;
  const rightW = pageWidth - leftW - colGap;
  const blockTop = y;

  const infoRows: [string, string][] = [
    ['Fecha', formatDate(date)],
    ['Venta', sale.saleNumber ?? '—'],
    ['Método', METHOD_LABELS[sale.paymentMethod ?? ''] ?? '—'],
    ['Estado', statusLabel],
  ];
  const extraLines = [data.clientDocument, data.clientAddress].filter(
    (line): line is string => Boolean(line),
  );
  const blockHeight =
    Math.max(13 + 15 + extraLines.length * 12, 13 + infoRows.length * 13) + 8;

  // Fondo del bloque (se pinta antes que el texto)
  doc.fillColor(KPI_BG).rect(startX, blockTop, pageWidth, blockHeight).fill();
  doc.fillColor(BRAND).rect(startX, blockTop, 3, blockHeight).fill();

  doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(7);
  doc.text('FACTURADO A', startX + 12, blockTop + 6, { lineBreak: false });

  let leftY = blockTop + 19;
  doc.fillColor(TEXT_MAIN).font('Helvetica-Bold').fontSize(11);
  doc.text(data.clientName || '—', startX + 12, leftY, {
    width: leftW - 20,
    ellipsis: true,
    lineBreak: false,
  });
  leftY += 15;

  doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(9);
  for (const line of extraLines) {
    doc.text(line, startX + 12, leftY, {
      width: leftW - 20,
      ellipsis: true,
      lineBreak: false,
    });
    leftY += 12;
  }

  const rightX = startX + leftW + colGap;
  let rightY = blockTop + 19;
  for (const [label, value] of infoRows) {
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8.5);
    doc.text(label, rightX, rightY, { width: rightW * 0.42, lineBreak: false });
    doc.fillColor(TEXT_MAIN).font('Helvetica-Bold').fontSize(8.5);
    doc.text(value, rightX + rightW * 0.42, rightY, {
      width: rightW * 0.58,
      align: 'right',
      ellipsis: true,
      lineBreak: false,
    });
    rightY += 13;
  }

  y = blockTop + blockHeight + 14;

  // ---------------- Detalle de líneas ----------------
  if (y + ROW_HEIGHT * 2 > contentBottom) y = newPage();

  doc.fillColor(TEXT_MAIN).font('Helvetica-Bold').fontSize(10);
  doc.text('Detalle de la venta', startX, y, { lineBreak: false });
  y += 18;

  const columns = [
    { header: 'Producto', weight: 3.2, align: 'left' as const },
    { header: 'Talla', weight: 1, align: 'left' as const },
    { header: 'Cant.', weight: 0.9, align: 'right' as const },
    { header: 'P. unitario', weight: 1.4, align: 'right' as const },
    { header: 'Subtotal', weight: 1.5, align: 'right' as const },
  ];
  const totalWeight = columns.reduce((sum, c) => sum + c.weight, 0);
  const widths = columns.map((c) => (c.weight / totalWeight) * pageWidth);

  const drawHeader = (yPos: number): number => {
    doc.rect(startX, yPos, pageWidth, ROW_HEIGHT).fill(BRAND);
    let x = startX;
    columns.forEach((column, i) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      doc.text(column.header, x + PAD_X, yPos + 5, {
        width: widths[i] - PAD_X * 2,
        align: column.align,
        ellipsis: true,
        lineBreak: false,
      });
      x += widths[i];
    });
    return yPos + ROW_HEIGHT;
  };

  y = drawHeader(y);

  if (sale.items.length === 0) {
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(9);
    doc.text('Sin productos registrados', startX + PAD_X, y + 4, {
      lineBreak: false,
    });
    y += ROW_HEIGHT;
  }

  sale.items.forEach((item, index) => {
    if (y + ROW_HEIGHT > contentBottom) {
      y = newPage();
      y = drawHeader(y);
    }
    if (index % 2 === 1) {
      doc.rect(startX, y, pageWidth, ROW_HEIGHT).fill(ZEBRA);
    }
    const cells = [
      item.productName,
      item.size ?? '—',
      String(item.quantity),
      formatCop(item.unitPrice),
      formatCop(item.subtotal),
    ];
    let x = startX;
    cells.forEach((text, i) => {
      doc.font('Helvetica').fontSize(8.5).fillColor(TEXT_MAIN);
      doc.text(text, x + PAD_X, y + (ROW_HEIGHT - LINE_HEIGHT) / 2, {
        width: widths[i] - PAD_X * 2,
        align: columns[i].align,
        ellipsis: true,
        lineBreak: false,
        height: LINE_HEIGHT,
      });
      if (i < cells.length - 1) {
        doc
          .strokeColor(GRID)
          .lineWidth(0.5)
          .moveTo(x + widths[i], y)
          .lineTo(x + widths[i], y + ROW_HEIGHT)
          .stroke();
      }
      x += widths[i];
    });
    doc
      .strokeColor(GRID)
      .lineWidth(0.5)
      .moveTo(startX, y + ROW_HEIGHT)
      .lineTo(right, y + ROW_HEIGHT)
      .stroke();
    y += ROW_HEIGHT;
  });

  // ---------------- Totales ----------------
  if (y + 110 > contentBottom) y = newPage();
  y += 14;

  const boxWidth = Math.min(270, pageWidth);
  const boxX = right - boxWidth;
  let totalsY = y;

  // % de IVA efectivo de esta factura (evita el hardcode "IVA 19%")
  const taxRate =
    data.subtotal > 0
      ? Math.round((data.tax / data.subtotal) * 100)
      : (data.taxRate ?? 19);

  const totalLines: { label: string; value: string; strong?: boolean }[] = [
    { label: 'Subtotal', value: formatCop(data.subtotal) },
    { label: `IVA ${taxRate}%`, value: formatCop(data.tax) },
    { label: 'TOTAL', value: formatCop(data.total), strong: true },
  ];

  for (const line of totalLines) {
    if (line.strong) {
      doc.rect(boxX, totalsY, boxWidth, 26).fill(BRAND);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11);
      doc.text(line.label, boxX + 10, totalsY + 7, {
        width: boxWidth * 0.45,
        lineBreak: false,
      });
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11);
      doc.text(line.value, boxX + boxWidth * 0.45, totalsY + 7, {
        width: boxWidth * 0.55 - 10,
        align: 'right',
        lineBreak: false,
      });
      totalsY += 26;
    } else {
      doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(9);
      doc.text(line.label, boxX + 10, totalsY + 3, {
        width: boxWidth * 0.45,
        lineBreak: false,
      });
      doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(9);
      doc.text(line.value, boxX + boxWidth * 0.45, totalsY + 3, {
        width: boxWidth * 0.55 - 10,
        align: 'right',
        lineBreak: false,
      });
      totalsY += 15;
    }
  }

  if (data.totalVes != null) {
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8);
    doc.text(
      `Equivalente: ${formatVes(data.totalVes)}`,
      boxX + 10,
      totalsY + 2,
      {
        width: boxWidth - 20,
        align: 'right',
        lineBreak: false,
      },
    );
    totalsY += 14;
  }

  y = totalsY + 4;

  // ---------------- Notas / anulación ----------------
  const notes: { label: string; text: string; color: string }[] = [];
  if (data.status === 'cancelled' && data.cancelledReason) {
    notes.push({
      label: 'Motivo de anulación',
      text: data.cancelledReason,
      color: '#dc2626',
    });
  }
  if (sale.notes) {
    notes.push({ label: 'Notas', text: sale.notes, color: TEXT_MUTED });
  }

  for (const note of notes) {
    const body = `${note.label}: ${note.text}`;
    const bodyHeight = doc.heightOfString(body, {
      width: pageWidth - 24,
      lineGap: 2,
    });
    if (y + bodyHeight + 24 > contentBottom) y = newPage();
    const boxHeight = bodyHeight + 22;
    doc.roundedRect(startX, y, pageWidth, boxHeight, 6).fill('#f8fafc');
    doc.rect(startX, y, 3, boxHeight).fill(note.color);
    doc.fillColor(note.color).font('Helvetica-Bold').fontSize(9);
    doc.text(body, startX + 12, y + 10, {
      width: pageWidth - 24,
      lineGap: 2,
    });
    doc.y = y + boxHeight;
    y += boxHeight + 12;
  }

  // ---------------- Pie de página ----------------
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .strokeColor(GRID)
      .lineWidth(0.8)
      .moveTo(startX, footerY - 7)
      .lineTo(right, footerY - 7)
      .stroke();
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(7.5);
    doc.text('ZettaStock', startX, footerY, { width: pageWidth });
    doc.y = footerY;
    doc.text(`Página ${i + 1} de ${range.count}`, startX, footerY, {
      width: pageWidth,
      align: 'center',
    });
    doc.y = footerY;
    doc.text(`Generado: ${formatDateTime(new Date())}`, startX, footerY, {
      width: pageWidth,
      align: 'right',
    });
    doc.y = footerY;
  }

  doc.end();
  return collectPdf(doc);
}
