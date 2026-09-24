import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExportRow {
  [key: string]: string | number;
}

export interface ExportMetaItem {
  label: string;
  value: string | number;
  money?: boolean;
}

export interface ExportChartItem {
  label: string;
  value: number;
  money?: boolean;
}

export interface ExportChart {
  title: string;
  items: ExportChartItem[];
}

export interface ExportTable {
  title: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  company?: string;
  meta?: ExportMetaItem[];
  charts?: ExportChart[];
}

const COPYABLE_KEY =
  /total|amount|base|value|price|revenue|subtotal|tax|difference|balance/i;

function formatCop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function formatMetaValue(item: ExportMetaItem): string {
  if (isNumber(item.value) && item.money) {
    return formatCop(item.value);
  }
  return String(item.value ?? '');
}

function formatChartValue(item: ExportChartItem): string {
  return item.money ? formatCop(item.value) : String(item.value);
}

function displayValue(column: ExportColumn, row: ExportRow): string {
  const value = row[column.key];
  if (isNumber(value) && COPYABLE_KEY.test(column.key)) {
    return formatCop(value);
  }
  return String(value ?? '');
}

function columnWidth(column: ExportColumn): number {
  return column.width ?? Math.min(Math.max(column.header.length + 2, 12), 32);
}

export async function exportToXlsx(table: ExportTable): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ZettaStock';
  const sheet = workbook.addWorksheet('Reporte');

  sheet.columns = table.columns.map((column) => ({
    key: column.key,
    header: column.header,
    width: columnWidth(column),
  }));

  const titleRow = sheet.insertRow(1, [table.title]);
  titleRow.font = { bold: true, size: 14 };
  sheet.mergeCells(1, 1, 1, table.columns.length);

  table.rows.forEach((row, index) => {
    const excelRow = sheet.insertRow(3 + index, row);
    excelRow.height = 18;
    table.columns.forEach((column) => {
      const cell = excelRow.getCell(column.key);
      if (isNumber(row[column.key])) {
        cell.numFmt = '#,##0';
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

const BRAND = '#1e40af';
const BRAND_HOVER = '#1e3a8a';
const ZEBRA = '#f1f5f9';
const GRID = '#e2e8f0';
const TEXT_MAIN = '#111827';
const TEXT_MUTED = '#6b7280';
const KPI_BG = '#f8fafc';
const CHART_PALETTE = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
const ROW_HEIGHT = 19;
const LINE_HEIGHT = 11;
const PAD_X = 5;

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

type Cell = { text: string; align: 'left' | 'right' };

type RowSpec = {
  cells: Cell[];
  header: boolean;
  index: number;
};

function isHeaderAlign(
  column: ExportColumn,
  rows: ExportRow[],
): 'left' | 'right' {
  return rows.some((row) => isNumber(row[column.key])) ? 'right' : 'left';
}

export function exportToPdf(table: ExportTable): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 40,
    bufferPages: true,
  });

  const startX = doc.page.margins.left;
  const pageWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const footerY = doc.page.height - doc.page.margins.bottom - 36;
  const contentBottom = footerY - 14;

  const weights = table.columns.map((column) =>
    Math.max(columnWidth(column), 10),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const scaled = weights.map((weight) =>
    Math.max((weight / totalWeight) * pageWidth, 36),
  );
  const scaledTotal = scaled.reduce((sum, width) => sum + width, 0);
  const widths = scaled.map((width) => (width / scaledTotal) * pageWidth);

  const headerCells: Cell[] = table.columns.map((column) => ({
    text: column.header,
    align: isHeaderAlign(column, table.rows),
  }));

  const rowSpecs: RowSpec[] = [
    { cells: headerCells, header: true, index: 0 },
    ...table.rows.map(
      (row, index): RowSpec => ({
        cells: table.columns.map((column) => ({
          text: displayValue(column, row),
          align: isNumber(row[column.key]) ? 'right' : 'left',
        })),
        header: false,
        index: index + 1,
      }),
    ),
  ];

  const renderRow = (spec: RowSpec) => {
    if (doc.y + ROW_HEIGHT > contentBottom) {
      doc.addPage();
      renderRow(rowSpecs[0]);
    }
    const y = doc.y;

    if (spec.header) {
      doc.rect(startX, y, pageWidth, ROW_HEIGHT).fill(BRAND);
    } else if (spec.index % 2 === 1) {
      doc.rect(startX, y, pageWidth, ROW_HEIGHT).fill(ZEBRA);
    }

    let x = startX;
    spec.cells.forEach((cell, i) => {
      doc
        .font(spec.header ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8.5)
        .fillColor(spec.header ? '#ffffff' : TEXT_MAIN)
        .text(cell.text, x + PAD_X, y + (ROW_HEIGHT - LINE_HEIGHT) / 2, {
          width: widths[i] - PAD_X * 2,
          align: cell.align,
          ellipsis: true,
          lineBreak: false,
          height: LINE_HEIGHT,
        });

      if (i < spec.cells.length - 1) {
        doc
          .strokeColor(GRID)
          .lineWidth(0.5)
          .moveTo(x + widths[i], y)
          .lineTo(x + widths[i], y + ROW_HEIGHT)
          .stroke();
      }
      x += widths[i];
    });

    if (!spec.header) {
      doc
        .strokeColor(GRID)
        .lineWidth(0.5)
        .moveTo(startX, y + ROW_HEIGHT)
        .lineTo(startX + pageWidth, y + ROW_HEIGHT)
        .stroke();
    }
    if (spec.header) {
      doc
        .strokeColor(BRAND_HOVER)
        .lineWidth(1)
        .moveTo(startX, y + ROW_HEIGHT)
        .lineTo(startX + pageWidth, y + ROW_HEIGHT)
        .stroke();
    }

    doc.y = y + ROW_HEIGHT;
  };

  const top = doc.page.margins.top;
  const hasCompany = Boolean(table.company);

  doc.rect(startX, top, pageWidth, 4).fill(BRAND);

  doc
    .fillColor(TEXT_MUTED)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('ZettaStock', startX, top + 10);
  doc
    .fillColor(TEXT_MUTED)
    .font('Helvetica')
    .fontSize(8)
    .text(
      `Generado: ${formatDateTime(new Date())}`,
      startX,
      top + 14,
      { width: pageWidth, align: 'right' },
    );

  if (hasCompany) {
    doc
      .fillColor(BRAND)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(table.company as string, startX, top + 26, {
        width: pageWidth,
        align: 'center',
      });
  }

  doc
    .fillColor(TEXT_MAIN)
    .font('Helvetica-Bold')
    .fontSize(17)
    .text(table.title, startX, top + (hasCompany ? 42 : 30), {
      width: pageWidth,
      align: 'center',
    });

  doc
    .strokeColor('#e5e7eb')
    .lineWidth(1)
    .moveTo(startX, top + (hasCompany ? 60 : 47))
    .lineTo(startX + pageWidth, top + (hasCompany ? 60 : 47))
    .stroke();

  doc.y = top + (hasCompany ? 72 : 59);

  const meta = table.meta ?? [];
  if (meta.length > 0) {
    const gap = 8;
    const cardW = (pageWidth - gap * (meta.length - 1)) / meta.length;
    const cardH = 26;
    const cardY = doc.y;
    meta.forEach((item, i) => {
      const x = startX + i * (cardW + gap);
      doc.rect(x, cardY, cardW, cardH).fill(KPI_BG);
      doc.rect(x, cardY, 3, cardH).fill(BRAND);
      doc
        .fillColor(TEXT_MUTED)
        .font('Helvetica-Bold')
        .fontSize(7)
        .text(item.label.toUpperCase(), x + 7, cardY + 4, {
          width: cardW - 12,
          align: 'left',
          ellipsis: true,
          lineBreak: false,
          height: 8,
        });
      doc
        .fillColor(TEXT_MAIN)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(formatMetaValue(item), x + 7, cardY + 13, {
          width: cardW - 12,
          align: 'left',
          ellipsis: true,
          lineBreak: false,
          height: 11,
        });
    });
    doc.y = cardY + cardH + 14;
  }

  const charts = (table.charts ?? []).filter(
    (chart) => chart.items.filter((item) => item.value > 0).length > 0,
  );
  if (charts.length > 0) {
    const gap = 8;
    const panelW = (pageWidth - gap * (charts.length - 1)) / charts.length;
    const pad = 10;
    const itemH = 14;
    const prepared = charts.map((chart) => ({
      title: chart.title,
      items: chart.items
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value),
      maxVal: Math.max(
        0,
        ...chart.items.filter((item) => item.value > 0).map((item) => item.value),
      ),
    }));
    const maxPanelH = Math.max(
      ...prepared.map((chart) => pad * 2 + 14 + chart.items.length * itemH),
    );
    const panelTop = doc.y;

    prepared.forEach((chart, ci) => {
      const x = startX + ci * (panelW + gap);
      doc.roundedRect(x, panelTop, panelW, maxPanelH, 8).fill('#ffffff');
      doc
        .roundedRect(x, panelTop, panelW, maxPanelH, 8)
        .strokeColor(GRID)
        .lineWidth(0.8)
        .stroke();
      doc
        .fillColor(TEXT_MAIN)
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .text(chart.title, x, panelTop + 8, {
          width: panelW,
          align: 'center',
        });

      let barY = panelTop + 24;
      const labelW = panelW - pad * 2 - 74;
      chart.items.forEach((item, i) => {
        const color = CHART_PALETTE[i % CHART_PALETTE.length];
        doc
          .fillColor(TEXT_MUTED)
          .font('Helvetica')
          .fontSize(7.5)
          .text(item.label, x + pad, barY, {
            width: labelW,
            ellipsis: true,
            lineBreak: false,
            height: 9,
          });
        doc
          .fillColor(TEXT_MAIN)
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .text(formatChartValue(item), x + pad, barY, {
            width: panelW - pad * 2,
            align: 'right',
          });
        const barW = Math.max(
          1,
          (item.value / chart.maxVal) * (panelW - pad * 2 - 68),
        );
        doc.rect(x + pad, barY + 9, barW, 4).fill(color);
        barY += itemH;
      });
    });

    doc.y = panelTop + maxPanelH + 14;
  }

  for (const spec of rowSpecs) {
    renderRow(spec);
  }

  if (table.rows.length === 0) {
    renderRow({
      cells: [
        {
          text: 'Sin registros para mostrar',
          align: 'left',
        },
        ...table.columns.slice(1).map(
          (column): Cell => ({
            text: '',
            align: isHeaderAlign(column, []),
          }),
        ),
      ],
      header: false,
      index: rowSpecs.length,
    });
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .strokeColor(GRID)
      .lineWidth(0.8)
      .moveTo(startX, footerY - 7)
      .lineTo(startX + pageWidth, footerY - 7)
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
  }

  doc.end();

  return (async () => {
    const chunks: Buffer[] = [];
    const readable = Readable.from(doc) as AsyncIterable<Buffer>;
    for await (const chunk of readable) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  })();
}
