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

export interface ExportTable {
  title: string;
  columns: ExportColumn[];
  rows: ExportRow[];
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

export function exportToPdf(table: ExportTable): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 40 });

  doc
    .font('Helvetica-Bold')
    .fontSize(15)
    .text(table.title, { align: 'center' });
  doc.moveDown();

  const pageWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const widths = table.columns.map((column) =>
    Math.min(columnWidth(column) * 7, pageWidth * 0.45),
  );
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const columnSpacing = table.columns.length > 1 ? 10 : 0;
  const layoutWidth =
    totalWidth + columnSpacing * Math.max(0, table.columns.length - 1);

  const drawRow = (cells: string[], font: string, size: number) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
    }
    const startX = doc.page.margins.left + (pageWidth - layoutWidth) / 2;
    widths.forEach((width, i) => {
      doc.font(font).fontSize(size);
      doc.text(cells[i] ?? '', startX + offsetX(i), doc.y, {
        width,
        ellipsis: true,
      });
    });
    doc.moveDown(0.2);
  };

  const offsetX = (index: number): number =>
    widths
      .slice(0, index)
      .reduce((sum, width) => sum + width + columnSpacing, 0);

  drawRow(
    table.columns.map((column) => column.header),
    'Helvetica-Bold',
    9,
  );

  table.rows
    .map((row) => table.columns.map((column) => displayValue(column, row)))
    .forEach((cells) => drawRow(cells, 'Helvetica', 8));

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
