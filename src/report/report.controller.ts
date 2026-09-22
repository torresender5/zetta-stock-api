import {
  Controller,
  Get,
  Req,
  Query,
  Inject,
  Res,
  Header,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthRoles } from '../auth/auth-roles.decorator';
import type { AuthUserPayload } from '../auth/auth-user.interface';
import { ReportService } from './report.service';
import type { ReportFormat } from './report.service';
import { ReportQueryDto, PaymentsReportQueryDto } from './dto/report.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

const MIME_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

@Controller('reports')
export class ReportController {
  constructor(
    private reportService: ReportService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  private reply<T>(
    res: Response,
    result: T | Buffer | null,
    filename: string,
    format?: ReportFormat,
  ) {
    if (Buffer.isBuffer(result) && format) {
      res.setHeader('Content-Type', MIME_TYPES[format]);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.${format}"`,
      );
      res.send(result);
      return undefined;
    }
    return result;
  }

  @AuthRoles('admin', 'vendedor')
  @Get('sales')
  @Header('Cache-Control', 'no-store')
  async sales(
    @Query() query: ReportQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
    @Res() res: Response,
  ) {
    this.logger.info('Starting ReportController sales');
    const result = await this.reportService.salesSummary(
      req.user?.companyId,
      query.startDate,
      query.endDate,
      query.export,
    );
    return this.reply(res, result, 'reporte-ventas', query.export);
  }

  @AuthRoles('admin', 'vendedor')
  @Get('top-products')
  @Header('Cache-Control', 'no-store')
  async topProducts(
    @Query() query: ReportQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
    @Res() res: Response,
  ) {
    this.logger.info('Starting ReportController top products');
    const result = await this.reportService.topProducts(
      req.user?.companyId,
      query.startDate,
      query.endDate,
      query.export,
    );
    return this.reply(res, result, 'productos-mas-vendidos', query.export);
  }

  @AuthRoles('admin', 'inventario')
  @Get('purchases')
  @Header('Cache-Control', 'no-store')
  async purchases(
    @Query() query: ReportQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
    @Res() res: Response,
  ) {
    this.logger.info('Starting ReportController purchases');
    const result = await this.reportService.purchasesSummary(
      req.user?.companyId,
      query.startDate,
      query.endDate,
      query.export,
    );
    return this.reply(res, result, 'reporte-compras', query.export);
  }

  @AuthRoles('admin', 'inventario')
  @Get('inventory')
  @Header('Cache-Control', 'no-store')
  async inventory(
    @Query() query: ReportQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
    @Res() res: Response,
  ) {
    this.logger.info('Starting ReportController inventory');
    const result = await this.reportService.inventoryReport(
      req.user?.companyId,
      query.export,
    );
    return this.reply(res, result, 'reporte-inventario', query.export);
  }

  @AuthRoles('admin', 'vendedor')
  @Get('cash-registers')
  @Header('Cache-Control', 'no-store')
  async cashRegisters(
    @Query() query: ReportQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
    @Res() res: Response,
  ) {
    this.logger.info('Starting ReportController cash registers');
    const result = await this.reportService.cashRegisterReport(
      req.user?.companyId,
      query.startDate,
      query.endDate,
      query.export,
    );
    return this.reply(res, result, 'reporte-caja', query.export);
  }

  @AuthRoles('admin', 'vendedor')
  @Get('accounts-receivable')
  @Header('Cache-Control', 'no-store')
  async receivables(
    @Query() query: PaymentsReportQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
    @Res() res: Response,
  ) {
    this.logger.info('Starting ReportController accounts receivable');
    const result = await this.reportService.receivablesReport(
      req.user?.companyId,
      query.status,
      query.startDate,
      query.endDate,
      query.export,
    );
    return this.reply(res, result, 'cuentas-por-cobrar', query.export);
  }

  @AuthRoles('admin', 'inventario')
  @Get('accounts-payable')
  @Header('Cache-Control', 'no-store')
  async payables(
    @Query() query: PaymentsReportQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
    @Res() res: Response,
  ) {
    this.logger.info('Starting ReportController accounts payable');
    const result = await this.reportService.payablesReport(
      req.user?.companyId,
      query.status,
      query.startDate,
      query.endDate,
      query.export,
    );
    return this.reply(res, result, 'cuentas-por-pagar', query.export);
  }

  @AuthRoles('admin', 'vendedor')
  @Get('apartados')
  @Header('Cache-Control', 'no-store')
  async apartados(
    @Query() query: ReportQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
    @Res() res: Response,
  ) {
    this.logger.info('Starting ReportController apartados');
    const result = await this.reportService.apartadosReport(
      req.user?.companyId,
      query.export,
    );
    return this.reply(res, result, 'reporte-apartados', query.export);
  }
}
