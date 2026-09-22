/* eslint-disable @typescript-eslint/no-unsafe-* */
import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from '../prisma/prisma.service';
import { ReportService } from './report.service';
import type {
  SalesSummary,
  InventoryReport,
  ApartadoReport,
  ReportFormat,
} from './report.service';

interface SaleMock {
  id: number;
  date: Date;
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: string;
  paymentMethod: string;
  items: unknown[];
}

interface ProductMock {
  id: number;
  name: string;
  code: string;
  category: string;
  stock: number;
  purchasePrice: number;
}

interface ApartadoMock {
  id: number;
  apartadoNumber: string;
  client: { name: string };
  date: Date;
  total: number;
  totalPaid: number;
  status: string;
}

describe('ReportService', () => {
  let service: ReportService;
  const prisma = {
    sale: { findMany: jest.fn() },
    purchase: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
    cashRegister: { findMany: jest.fn() },
    apartado: { findMany: jest.fn() },
    $queryRawUnsafe: jest.fn(),
  };
  const logger = { info: jest.fn() } as unknown as Logger;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('salesSummary', () => {
    it('aggregates sales excluding cancelled ones from totals', async () => {
      const sales: SaleMock[] = [
        {
          id: 1,
          date: new Date('2026-01-10T10:00:00Z'),
          subtotal: 100,
          tax: 19,
          total: 119,
          paymentStatus: 'paid',
          paymentMethod: 'cash',
          items: [],
        },
        {
          id: 2,
          date: new Date('2026-01-10T12:00:00Z'),
          subtotal: 50,
          tax: 10,
          total: 60,
          paymentStatus: 'pending',
          paymentMethod: 'cash',
          items: [],
        },
        {
          id: 3,
          date: new Date('2026-01-11T10:00:00Z'),
          subtotal: 200,
          tax: 38,
          total: 238,
          paymentStatus: 'cancelled',
          paymentMethod: 'card',
          items: [],
        },
      ];
      prisma.sale.findMany.mockResolvedValue(sales);

      const result = (await service.salesSummary(
        7,
        '2026-01-01',
        '2026-01-31',
        undefined,
      )) as SalesSummary;

      expect(prisma.sale.findMany).toHaveBeenCalledWith({
        where: {
          companyId: 7,
          date: { gte: expect.any(Date), lte: expect.any(Date) },
        },
        include: { items: true },
      });
      expect(result.totalCount).toBe(2);
      expect(result.totalSales).toBe(179);
      expect(result.subtotal).toBe(150);
      expect(result.tax).toBe(29);
      expect(result.byPaymentStatus).toEqual({
        paid: 119,
        pending: 60,
        cancelled: 238,
      });
      expect(result.byPeriod).toHaveLength(2);
      expect(result.byPeriod[0].total).toBe(179);
      expect(result.byPeriod[0].date).toBe('2026-01-10');
    });

    it('returns an exported buffer when a format is requested', async () => {
      prisma.sale.findMany.mockResolvedValue([]);

      const buffer = (await service.salesSummary(
        7,
        '2026-01-01',
        '2026-01-31',
        'pdf' as ReportFormat,
      )) as Buffer;

      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe('inventoryReport', () => {
    it('computes stock values and marks low stock', async () => {
      const products: ProductMock[] = [
        {
          id: 1,
          name: 'Camisa',
          code: 'C-1',
          category: 'Ropa',
          stock: 3,
          purchasePrice: 10000,
        },
        {
          id: 2,
          name: 'Pantalón',
          code: 'P-1',
          category: 'Ropa',
          stock: 25,
          purchasePrice: 20000,
        },
      ];
      prisma.product.findMany.mockResolvedValue(products);

      const result = (await service.inventoryReport(7)) as InventoryReport;

      expect(result.totalItems).toBe(2);
      expect(result.totalStock).toBe(28);
      expect(result.totalStockValue).toBe(530000);
      expect(result.lowStockCount).toBe(1);
      expect(result.products[0].lowStock).toBe(true);
      expect(result.products[1].lowStock).toBe(false);
    });
  });

  describe('apartadosReport', () => {
    it('summarizes balances of active and paid apartados', async () => {
      const apartados: ApartadoMock[] = [
        {
          id: 1,
          apartadoNumber: 'AP-2026-0001',
          client: { name: 'Ana' },
          date: new Date('2026-01-05T10:00:00Z'),
          total: 500,
          totalPaid: 200,
          status: 'active',
        },
        {
          id: 2,
          apartadoNumber: 'AP-2026-0002',
          client: { name: 'Luis' },
          date: new Date('2026-01-06T10:00:00Z'),
          total: 300,
          totalPaid: 300,
          status: 'paid',
        },
      ];
      prisma.apartado.findMany.mockResolvedValue(apartados);

      const result = (await service.apartadosReport(
        7,
        undefined,
      )) as ApartadoReport;

      expect(result.totalActive).toBe(1);
      expect(result.totalBalance).toBe(300);
      expect(result.rows[0].balance).toBe(300);
      expect(result.rows[1].status).toBe('paid');
    });
  });
});
