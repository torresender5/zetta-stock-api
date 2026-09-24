import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  exportToXlsx,
  exportToPdf,
  ExportTable,
  ExportColumn,
  ExportRow,
  ExportMetaItem,
  ExportChart,
  ExportChartItem,
} from './report-export.util';
import {
  SalesSummary,
  TopProductRow,
  PurchasesSummary,
  InventoryReport,
  InventoryRow,
  CashRegisterReportRow,
  AgingRow,
  ApartadoReport,
} from './interface/report.interface';

export type ReportFormat = 'xlsx' | 'pdf';

type ExportOptions = Pick<ExportTable, 'company' | 'meta' | 'charts'>;

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  cancelled: 'Cancelado',
  active: 'Activo',
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  credit: 'Crédito',
};

@Injectable()
export class ReportService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  private dateRange(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) {
      return undefined;
    }
    const base: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      base.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      base.lte = end;
    }
    return base;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private mapTotals(
    record: Record<string, number>,
    labels: Record<string, string>,
  ): ExportChartItem[] {
    return Object.entries(record)
      .map(([key, value]) => ({
        label: labels[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
        value: this.round(value),
        money: true,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }

  private async buildExport(
    columns: ExportColumn[],
    rows: ExportRow[],
    titles: Record<ReportFormat, string>,
    format?: ReportFormat,
    options: ExportOptions = {},
  ) {
    if (!format) {
      return null;
    }
    const table: ExportTable = {
      title: titles[format],
      columns,
      rows,
      ...options,
    };
    if (format === 'xlsx') {
      return exportToXlsx(table);
    }
    return await exportToPdf(table);
  }

  async salesSummary(
    companyId: number | undefined,
    startDate?: string,
    endDate?: string,
    format?: ReportFormat,
    companyName?: string,
  ): Promise<SalesSummary | Buffer | null> {
    this.logger.info('Generating sales summary report');
    const where = {
      ...(companyId ? { companyId } : {}),
      date: this.dateRange(startDate, endDate),
    };

    const sales = await this.prisma.sale.findMany({
      where,
      include: { items: true },
    });

    const totalSales = sales
      .filter((sale) => sale.paymentStatus !== 'cancelled')
      .reduce((sum, sale) => sum + sale.total, 0);
    const totalCount = sales.filter(
      (sale) => sale.paymentStatus !== 'cancelled',
    ).length;
    const subtotal = sales
      .filter((sale) => sale.paymentStatus !== 'cancelled')
      .reduce((sum, sale) => sum + sale.subtotal, 0);
    const tax = sales
      .filter((sale) => sale.paymentStatus !== 'cancelled')
      .reduce((sum, sale) => sum + sale.tax, 0);

    const byPaymentMethod: Record<string, number> = {};
    const byPaymentStatus: Record<string, number> = {};
    const byDate = new Map<
      string,
      { count: number; subtotal: number; tax: number; total: number }
    >();

    for (const sale of sales) {
      const method = sale.paymentMethod || 'cash';
      byPaymentMethod[method] = this.round(
        (byPaymentMethod[method] || 0) + sale.total,
      );
      byPaymentStatus[sale.paymentStatus] = this.round(
        (byPaymentStatus[sale.paymentStatus] || 0) + sale.total,
      );
      const key = sale.date.toISOString().slice(0, 10);
      const current = byDate.get(key) ?? {
        count: 0,
        subtotal: 0,
        tax: 0,
        total: 0,
      };
      current.count += 1;
      current.subtotal = this.round(current.subtotal + sale.subtotal);
      current.tax = this.round(current.tax + sale.tax);
      current.total = this.round(current.total + sale.total);
      byDate.set(key, current);
    }

    const byPeriod = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, ...value }));

    const report: SalesSummary = {
      startDate: startDate ?? '',
      endDate: endDate ?? '',
      totalSales: this.round(totalSales),
      totalCount,
      subtotal,
      tax,
      byPaymentMethod,
      byPaymentStatus,
      byPeriod,
    };

    return (
      (await this.buildExport(
        [
          { header: 'Fecha', key: 'date', width: 14 },
          { header: 'Ventas', key: 'count', width: 10 },
          { header: 'Subtotal', key: 'subtotal', width: 16 },
          { header: 'IVA', key: 'tax', width: 14 },
          { header: 'Total', key: 'total', width: 16 },
        ],
        byPeriod.map((row) => ({ ...row })),
        { xlsx: 'Reporte de Ventas', pdf: 'Reporte de Ventas' },
        format,
        {
          company: companyName,
          meta: [
            {
              label: 'Total ventas',
              value: this.round(totalSales),
              money: true,
            },
            { label: 'Nº ventas', value: totalCount },
            { label: 'Subtotal', value: this.round(subtotal), money: true },
            { label: 'IVA', value: this.round(tax), money: true },
          ],
          charts: [
            {
              title: 'Ingresos por Estado',
              items: this.mapTotals(byPaymentStatus, STATUS_LABELS),
            },
            {
              title: 'Ingresos por Método de Pago',
              items: this.mapTotals(byPaymentMethod, METHOD_LABELS),
            },
          ],
        },
      )) ?? report
    );
  }

  async topProducts(
    companyId: number | undefined,
    startDate?: string,
    endDate?: string,
    format?: ReportFormat,
    companyName?: string,
  ): Promise<TopProductRow[] | Buffer | null> {
    this.logger.info('Generating top products report');
    const where = {
      ...(companyId ? { companyId } : {}),
      date: this.dateRange(startDate, endDate),
    };
    const sales = await this.prisma.sale.findMany({
      where,
      include: { items: true },
    });

    const map = new Map<
      number,
      { productId: number; name: string; quantity: number; revenue: number }
    >();
    for (const sale of sales) {
      for (const item of sale.items) {
        const current = map.get(item.productId) ?? {
          productId: item.productId,
          name: item.productName,
          quantity: 0,
          revenue: 0,
        };
        current.quantity += item.quantity;
        current.revenue = this.round(current.revenue + item.subtotal);
        map.set(item.productId, current);
      }
    }

    const rows = [...map.values()].sort((a, b) => b.quantity - a.quantity);

    const meta: ExportMetaItem[] = [
      {
        label: 'Total ingresos',
        value: this.round(rows.reduce((sum, row) => sum + row.revenue, 0)),
        money: true,
      },
      {
        label: 'Unidades vendidas',
        value: rows.reduce((sum, row) => sum + row.quantity, 0),
      },
      { label: 'Productos', value: rows.length },
      { label: 'Top producto', value: rows[0]?.name ?? '—' },
    ];

    const charts: ExportChart[] = [
      {
        title: 'Ingresos por Producto',
        items: rows
          .slice(0, 8)
          .map((row) => ({
            label: row.name,
            value: this.round(row.revenue),
            money: true,
          }))
          .filter((item) => item.value > 0),
      },
    ];

    return (
      (await this.buildExport(
        [
          { header: 'Producto', key: 'name', width: 26 },
          { header: 'Cantidad', key: 'quantity', width: 10 },
          { header: 'Ingresos', key: 'revenue', width: 18 },
        ],
        rows.map((row) => ({ ...row })),
        { xlsx: 'Productos Más Vendidos', pdf: 'Productos Más Vendidos' },
        format,
        { company: companyName, meta, charts },
      )) ?? rows
    );
  }

  async purchasesSummary(
    companyId: number | undefined,
    startDate?: string,
    endDate?: string,
    format?: ReportFormat,
    companyName?: string,
  ): Promise<PurchasesSummary | Buffer | null> {
    this.logger.info('Generating purchases summary report');
    const where = {
      ...(companyId ? { companyId } : {}),
      date: this.dateRange(startDate, endDate),
    };

    const purchases = await this.prisma.purchase.findMany({
      where,
      include: { supplier: true },
    });

    const totalPurchases = purchases.reduce((sum, p) => sum + p.total, 0);
    const subtotal = purchases.reduce((sum, p) => sum + p.subtotal, 0);
    const tax = purchases.reduce((sum, p) => sum + p.tax, 0);

    const byPaymentStatus: Record<string, number> = {};
    const bySupplierMap = new Map<
      number,
      { supplierId: number; supplier: string; count: number; total: number }
    >();

    for (const purchase of purchases) {
      byPaymentStatus[purchase.paymentStatus] = this.round(
        (byPaymentStatus[purchase.paymentStatus] || 0) + purchase.total,
      );
      const supplierId = purchase.supplierId;
      const current = bySupplierMap.get(supplierId) ?? {
        supplierId,
        supplier: purchase.supplier?.name ?? 'Sin proveedor',
        count: 0,
        total: 0,
      };
      current.count += 1;
      current.total = this.round(current.total + purchase.total);
      bySupplierMap.set(supplierId, current);
    }

    const bySupplier = [...bySupplierMap.values()].sort(
      (a, b) => b.total - a.total,
    );

    const report: PurchasesSummary = {
      startDate: startDate ?? '',
      endDate: endDate ?? '',
      totalPurchases: this.round(totalPurchases),
      totalCount: purchases.length,
      subtotal,
      tax,
      byPaymentStatus,
      bySupplier,
    };

    return (
      (await this.buildExport(
        [
          { header: 'Proveedor', key: 'supplier', width: 24 },
          { header: 'Compras', key: 'count', width: 10 },
          { header: 'Total', key: 'total', width: 16 },
        ],
        bySupplier.map((row) => ({ ...row })),
        { xlsx: 'Reporte de Compras', pdf: 'Reporte de Compras' },
        format,
        {
          company: companyName,
          meta: [
            {
              label: 'Total compras',
              value: this.round(totalPurchases),
              money: true,
            },
            { label: 'Nº compras', value: purchases.length },
            { label: 'Subtotal', value: this.round(subtotal), money: true },
            { label: 'IVA', value: this.round(tax), money: true },
          ],
          charts: [
            {
              title: 'Compras por Estado',
              items: this.mapTotals(byPaymentStatus, STATUS_LABELS),
            },
          ],
        },
      )) ?? report
    );
  }

  async inventoryReport(
    companyId: number | undefined,
    format?: ReportFormat,
    companyName?: string,
  ): Promise<InventoryReport | Buffer | null> {
    this.logger.info('Generating inventory report');
    const products = await this.prisma.product.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { name: 'asc' },
    });

    const rows: InventoryRow[] = products.map((product) => ({
      productId: product.id,
      name: product.name,
      code: product.code,
      category: product.category,
      stock: product.stock,
      purchasePrice: product.purchasePrice,
      stockValue: this.round(product.purchasePrice * product.stock),
      lowStock: product.stock < 10,
    }));

    const report: InventoryReport = {
      products: rows,
      totalItems: rows.length,
      totalStock: rows.reduce((sum, row) => sum + row.stock, 0),
      totalStockValue: this.round(
        rows.reduce((sum, row) => sum + row.stockValue, 0),
      ),
      lowStockCount: rows.filter((row) => row.lowStock).length,
    };

    const byCategory = new Map<string, number>();
    for (const row of rows) {
      const category = row.category || 'Sin categoría';
      byCategory.set(
        category,
        this.round((byCategory.get(category) ?? 0) + row.stockValue),
      );
    }

    const charts: ExportChart[] = [
      {
        title: 'Valor de Inventario por Categoría',
        items: [...byCategory.entries()]
          .map(([label, value]) => ({ label, value, money: true }))
          .filter((item) => item.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 8),
      },
    ];

    return (
      (await this.buildExport(
        [
          { header: 'Producto', key: 'name', width: 26 },
          { header: 'Código', key: 'code', width: 12 },
          { header: 'Categoría', key: 'category', width: 14 },
          { header: 'Stock', key: 'stock', width: 10 },
          { header: 'Costo Unit.', key: 'purchasePrice', width: 14 },
          { header: 'Valor en Costo', key: 'stockValue', width: 18 },
        ],
        rows.map((row) => ({
          name: row.name,
          code: row.code,
          category: row.category,
          stock: row.stock,
          purchasePrice: row.purchasePrice,
          stockValue: row.stockValue,
        })),
        { xlsx: 'Reporte de Inventario', pdf: 'Reporte de Inventario' },
        format,
        {
          company: companyName,
          meta: [
            { label: 'Productos', value: report.totalItems },
            { label: 'Unidades en stock', value: report.totalStock },
            {
              label: 'Valor en costo',
              value: report.totalStockValue,
              money: true,
            },
            { label: 'Bajo stock', value: report.lowStockCount },
          ],
          charts,
        },
      )) ?? report
    );
  }

  async cashRegisterReport(
    companyId: number | undefined,
    startDate?: string,
    endDate?: string,
    format?: ReportFormat,
    companyName?: string,
  ): Promise<
    { cashRegisters: CashRegisterReportRow[]; count: number } | Buffer | null
  > {
    this.logger.info('Generating cash register report');
    const where = {
      ...(companyId ? { companyId } : {}),
      openedAt: this.dateRange(startDate, endDate),
    };

    const registers = await this.prisma.cashRegister.findMany({
      where,
      include: { user: true },
      orderBy: { openedAt: 'desc' },
    });

    const cashRegisters: CashRegisterReportRow[] = registers.map(
      (register) => ({
        id: register.id,
        name: register.name,
        status: register.status,
        user: register.user?.user ?? '',
        openedAt: register.openedAt.toISOString(),
        closedAt: register.closedAt?.toISOString() ?? null,
        baseAmount: register.baseAmount,
        expectedTotal: register.expectedTotal ?? 0,
        countedTotal: register.countedTotal ?? 0,
        difference: register.difference ?? 0,
      }),
    );

    const report = { cashRegisters, count: cashRegisters.length };

    const baseTotal = cashRegisters.reduce(
      (sum, row) => sum + row.baseAmount,
      0,
    );
    const expectedTotal = cashRegisters.reduce(
      (sum, row) => sum + (row.expectedTotal ?? 0),
      0,
    );
    const differenceTotal = cashRegisters.reduce(
      (sum, row) => sum + (row.difference ?? 0),
      0,
    );

    const charts: ExportChart[] = [
      {
        title: 'Esperado por Caja',
        items: cashRegisters
          .map((row) => ({
            label: row.name,
            value: this.round(row.expectedTotal ?? 0),
            money: true,
          }))
          .filter((item) => item.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 8),
      },
    ];

    return (
      (await this.buildExport(
        [
          { header: 'Nombre', key: 'name', width: 18 },
          { header: 'Usuario', key: 'user', width: 16 },
          { header: 'Abierta', key: 'openedAt', width: 18 },
          { header: 'Cerrada', key: 'closedAt', width: 18 },
          { header: 'Base', key: 'baseAmount', width: 14 },
          { header: 'Esperado', key: 'expectedTotal', width: 16 },
          { header: 'Contado', key: 'countedTotal', width: 16 },
          { header: 'Diferencia', key: 'difference', width: 14 },
        ],
        cashRegisters.map((row) => ({
          ...row,
          openedAt: row.openedAt.slice(0, 10),
          closedAt: row.closedAt?.slice(0, 10) ?? 'abierta',
          expectedTotal: row.expectedTotal ?? 0,
          countedTotal: row.countedTotal ?? 0,
          difference: row.difference ?? 0,
        })),
        { xlsx: 'Reporte de Caja', pdf: 'Reporte de Caja' },
        format,
        {
          company: companyName,
          meta: [
            { label: 'Cajas', value: report.count },
            { label: 'Base total', value: this.round(baseTotal), money: true },
            {
              label: 'Esperado total',
              value: this.round(expectedTotal),
              money: true,
            },
            {
              label: 'Diferencia',
              value: this.round(differenceTotal),
              money: true,
            },
          ],
          charts,
        },
      )) ?? report
    );
  }

  private async buildAging(
    table: 'sale' | 'purchase',
    nameColumn: string,
    companyId: number | undefined,
    status: 'paid' | 'pending',
    startDate?: string,
    endDate?: string,
  ): Promise<AgingRow[]> {
    const nameField = table === 'sale' ? 'clientId' : 'supplierId';
    const tableName = table === 'sale' ? 'Sale' : 'Purchase';
    const filter: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (companyId !== undefined) {
      filter.push(`t."companyId" = $${paramIndex++}`);
      params.push(companyId);
    }
    filter.push(`t."paymentStatus" = $${paramIndex++}`);
    params.push(status);

    if (startDate) {
      filter.push(`t."date" >= $${paramIndex++}::date`);
      params.push(startDate);
    }
    if (endDate) {
      filter.push(`t."date" <= ($${paramIndex++}::date + interval '1 day')`);
      params.push(endDate);
    }

    const whereSql = [`t."${nameField}" IS NOT NULL`, ...filter].join(' AND ');

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: number;
        name: string;
        pendingCount: number;
        total: number;
        days0: number;
        days30: number;
        days60: number;
        days90: number;
      }>
    >(
      `SELECT
        e.id,
        e.name,
        COUNT(t.id) AS "pendingCount",
        COALESCE(SUM(t.total), 0)::float AS total,
        COALESCE(SUM(CASE WHEN (CURRENT_DATE - t."date"::date) <= 30 THEN t.total ELSE 0 END), 0)::float AS "days0",
        COALESCE(SUM(CASE WHEN (CURRENT_DATE - t."date"::date) BETWEEN 31 AND 60 THEN t.total ELSE 0 END), 0)::float AS "days30",
        COALESCE(SUM(CASE WHEN (CURRENT_DATE - t."date"::date) BETWEEN 61 AND 90 THEN t.total ELSE 0 END), 0)::float AS "days60",
        COALESCE(SUM(CASE WHEN (CURRENT_DATE - t."date"::date) > 90 THEN t.total ELSE 0 END), 0)::float AS "days90"
      FROM "${tableName}" t
      JOIN "${nameField === 'clientId' ? 'Client' : 'Supplier'}" e
        ON e.id = t."${nameField}"
      WHERE ${whereSql}
      GROUP BY e.id, e.name
      ORDER BY total DESC`,
      ...params,
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      pendingCount: Number(row.pendingCount ?? 0),
      total: this.round(Number(row.total ?? 0)),
      current: this.round(Number(row.days0 ?? 0)),
      days30: this.round(Number(row.days30 ?? 0)),
      days60: this.round(Number(row.days60 ?? 0)),
      days90: this.round(Number(row.days90 ?? 0)),
    }));
  }

  async receivablesReport(
    companyId: number | undefined,
    status: 'paid' | 'pending' | undefined,
    startDate?: string,
    endDate?: string,
    format?: ReportFormat,
    companyName?: string,
  ): Promise<
    | { startDate: string; endDate: string; rows: AgingRow[]; total: number }
    | Buffer
    | null
  > {
    this.logger.info('Generating accounts receivable report');
    const effectiveStatus = status ?? 'pending';
    const rows = await this.buildAging(
      'sale',
      'clientId',
      companyId,
      effectiveStatus,
      startDate,
      endDate,
    );

    const report = {
      startDate: startDate ?? '',
      endDate: endDate ?? '',
      rows,
      total: this.round(rows.reduce((sum, row) => sum + row.total, 0)),
    };

    const agingMoney = (key: keyof AgingRow): number =>
      this.round(rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0));

    return (
      (await this.buildExport(
        [
          { header: 'Cliente', key: 'name', width: 26 },
          { header: 'Ventas', key: 'pendingCount', width: 10 },
          { header: 'Hoy-30d', key: 'current', width: 14 },
          { header: '31-60d', key: 'days30', width: 14 },
          { header: '61-90d', key: 'days60', width: 14 },
          { header: '+90d', key: 'days90', width: 14 },
          { header: 'Total', key: 'total', width: 18 },
        ],
        rows.map((row) => ({ ...row })),
        { xlsx: 'Cuentas por Cobrar', pdf: 'Cuentas por Cobrar' },
        format,
        {
          company: companyName,
          meta: [
            { label: 'Total por Cobrar', value: report.total, money: true },
            { label: 'Nº Clientes', value: rows.length },
            { label: 'Saldo 31-60d', value: agingMoney('days30'), money: true },
            { label: 'Saldo +90d', value: agingMoney('days90'), money: true },
          ],
          charts: [
            {
              title: 'Antigüedad de Deudas',
              items: [
                { label: 'Hoy-30', value: agingMoney('current'), money: true },
                { label: '31-60', value: agingMoney('days30'), money: true },
                { label: '61-90', value: agingMoney('days60'), money: true },
                { label: '+90', value: agingMoney('days90'), money: true },
              ],
            },
          ],
        },
      )) ?? report
    );
  }

  async payablesReport(
    companyId: number | undefined,
    status: 'paid' | 'pending' | undefined,
    startDate?: string,
    endDate?: string,
    format?: ReportFormat,
    companyName?: string,
  ): Promise<
    | { startDate: string; endDate: string; rows: AgingRow[]; total: number }
    | Buffer
    | null
  > {
    this.logger.info('Generating accounts payable report');
    const effectiveStatus = status ?? 'pending';
    const rows = await this.buildAging(
      'purchase',
      'supplierId',
      companyId,
      effectiveStatus,
      startDate,
      endDate,
    );

    const report = {
      startDate: startDate ?? '',
      endDate: endDate ?? '',
      rows,
      total: this.round(rows.reduce((sum, row) => sum + row.total, 0)),
    };

    const agingMoney = (key: keyof AgingRow): number =>
      this.round(rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0));

    return (
      (await this.buildExport(
        [
          { header: 'Proveedor', key: 'name', width: 26 },
          { header: 'Compras', key: 'pendingCount', width: 10 },
          { header: 'Hoy-30d', key: 'current', width: 14 },
          { header: '31-60d', key: 'days30', width: 14 },
          { header: '61-90d', key: 'days60', width: 14 },
          { header: '+90d', key: 'days90', width: 14 },
          { header: 'Total', key: 'total', width: 18 },
        ],
        rows.map((row) => ({ ...row })),
        { xlsx: 'Cuentas por Pagar', pdf: 'Cuentas por Pagar' },
        format,
        {
          company: companyName,
          meta: [
            { label: 'Total por Pagar', value: report.total, money: true },
            { label: 'Nº Proveedores', value: rows.length },
            { label: 'Saldo 31-60d', value: agingMoney('days30'), money: true },
            { label: 'Saldo +90d', value: agingMoney('days90'), money: true },
          ],
          charts: [
            {
              title: 'Antigüedad de Deudas',
              items: [
                { label: 'Hoy-30', value: agingMoney('current'), money: true },
                { label: '31-60', value: agingMoney('days30'), money: true },
                { label: '61-90', value: agingMoney('days60'), money: true },
                { label: '+90', value: agingMoney('days90'), money: true },
              ],
            },
          ],
        },
      )) ?? report
    );
  }

  async apartadosReport(
    companyId: number | undefined,
    format?: ReportFormat,
    companyName?: string,
  ): Promise<ApartadoReport | Buffer | null> {
    this.logger.info('Generating apartados report');
    const apartados = await this.prisma.apartado.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        status: {
          in: ['active', 'paid'],
        },
      },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });

    const rows: ApartadoReport['rows'] = apartados.map((apartado) => ({
      id: apartado.id,
      apartadoNumber: apartado.apartadoNumber,
      client: apartado.client?.name ?? 'Sin cliente',
      date: apartado.date.toISOString().slice(0, 10),
      total: this.round(apartado.total),
      totalPaid: this.round(apartado.totalPaid),
      balance: this.round(apartado.total - apartado.totalPaid),
      status: apartado.status,
    }));

    const report: ApartadoReport = {
      rows,
      totalActive: rows.filter((row) => row.status === 'active').length,
      totalBalance: this.round(
        rows
          .filter((row) => row.status === 'active')
          .reduce((sum, row) => sum + row.balance, 0),
      ),
    };

    const paid = rows.filter((row) => row.status === 'paid').length;

    return (
      (await this.buildExport(
        [
          { header: 'Nº Apartado', key: 'apartadoNumber', width: 16 },
          { header: 'Cliente', key: 'client', width: 24 },
          { header: 'Fecha', key: 'date', width: 14 },
          { header: 'Total', key: 'total', width: 14 },
          { header: 'Pagado', key: 'totalPaid', width: 14 },
          { header: 'Saldo', key: 'balance', width: 14 },
          { header: 'Estado', key: 'status', width: 10 },
        ],
        rows.map((row) => ({ ...row })),
        { xlsx: 'Reporte de Apartados', pdf: 'Reporte de Apartados' },
        format,
        {
          company: companyName,
          meta: [
            { label: 'Apartados Activos', value: report.totalActive },
            { label: 'Apartados Pagados', value: paid },
            { label: 'Nº Apartados', value: rows.length },
            { label: 'Saldo Total', value: report.totalBalance, money: true },
          ],
          charts: [
            {
              title: 'Saldo por Cliente',
              items: rows
                .filter((row) => row.status === 'active')
                .slice(0, 8)
                .map((row) => ({
                  label: row.client,
                  value: row.balance,
                  money: true,
                })),
            },
          ],
        },
      )) ?? report
    );
  }
}
