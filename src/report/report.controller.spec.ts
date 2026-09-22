/* eslint-disable @typescript-eslint/no-unsafe-* */
import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { JwtService } from '@nestjs/jwt';
import { Logger } from 'winston';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import type { ReportQueryDto } from './dto/report.dto';

interface ResLike {
  setHeader: jest.Mock;
  send: jest.Mock;
}

const EXPORT_CASES = [
  { controllerMethod: 'sales', serviceMethod: 'salesSummary' },
  { controllerMethod: 'topProducts', serviceMethod: 'topProducts' },
  { controllerMethod: 'purchases', serviceMethod: 'purchasesSummary' },
  { controllerMethod: 'inventory', serviceMethod: 'inventoryReport' },
  { controllerMethod: 'cashRegisters', serviceMethod: 'cashRegisterReport' },
  {
    controllerMethod: 'receivables',
    serviceMethod: 'receivablesReport',
  },
  {
    controllerMethod: 'payables',
    serviceMethod: 'payablesReport',
  },
  { controllerMethod: 'apartados', serviceMethod: 'apartadosReport' },
] as const;

describe('ReportController', () => {
  let controller: ReportController;
  let service: Record<string, jest.Mock>;

  const query = { startDate: '2026-01-01', endDate: '2026-01-31' };
  const req = {
    user: { sub: 1, role: 'admin', companyId: 7 },
  } as unknown as Request;

  const logger = { info: jest.fn() } as unknown as Logger;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = {
      salesSummary: jest.fn(),
      topProducts: jest.fn(),
      purchasesSummary: jest.fn(),
      inventoryReport: jest.fn(),
      cashRegisterReport: jest.fn(),
      receivablesReport: jest.fn(),
      payablesReport: jest.fn(),
      apartadosReport: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [
        { provide: ReportService, useValue: service },
        { provide: PrismaService, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
      ],
    }).compile();

    controller = module.get<ReportController>(ReportController);
  });

  const res = (): ResLike & Response =>
    ({ setHeader: jest.fn(), send: jest.fn() }) as ResLike & Response;

  const callExport = (
    method: (typeof EXPORT_CASES)[number]['controllerMethod'],
    response: ResLike & Response,
  ): Promise<any> =>
    Promise.resolve(
      (
        controller[method] as (
          q: ReportQueryDto,
          r: Request,
          s: Response,
        ) => unknown
      )({ export: 'pdf' } as ReportQueryDto, req, response),
    );

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the JSON report when no export format is requested', async () => {
    service.salesSummary.mockResolvedValue({ totalSales: 100 });

    const result = await controller.sales(query as ReportQueryDto, req, res());

    expect(result).toEqual({ totalSales: 100 });
    expect(service.salesSummary).toHaveBeenCalledWith(
      7,
      '2026-01-01',
      '2026-01-31',
      undefined,
    );
  });

  it.each(EXPORT_CASES)(
    'sends the exported buffer for $controllerMethod when export is requested',
    async ({ controllerMethod, serviceMethod }) => {
      const expected = Buffer.from('file');
      service[serviceMethod].mockResolvedValue(expected);

      const response = res();
      const result = await callExport(controllerMethod, response);

      expect(result).toBeUndefined();
      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(/\.pdf"$/),
      );
      expect(response.send).toHaveBeenCalledWith(expected);
    },
  );

  it('returns the inventory report', async () => {
    service.inventoryReport.mockResolvedValue({ totalItems: 0 });

    const result = await controller.inventory(
      query as ReportQueryDto,
      req,
      res(),
    );

    expect(result).toEqual({ totalItems: 0 });
    expect(service.inventoryReport).toHaveBeenCalledWith(7, undefined);
  });
});
