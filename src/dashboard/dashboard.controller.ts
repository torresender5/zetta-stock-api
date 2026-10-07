import { Controller, Get, Inject, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthRoles } from '../auth/auth-roles.decorator';
import type { AuthUserPayload } from '../auth/auth-user.interface';
import { ReportService } from '../report/report.service';
import { ReportQueryDto } from '../report/dto/report.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly reportService: ReportService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * Datos del dashboard en una sola petición: resumen de ventas (totales y
   * serie diaria para las gráficas), top de productos y top de clientes.
   * Vive fuera de `/reports` para que también responda a planes `free`
   * (vista `dashboard`), sin descargarse todas las ventas en el cliente.
   */
  @AuthRoles('admin', 'vendedor')
  @Get('summary')
  summary(
    @Query() query: ReportQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting DashboardController summary');
    return this.reportService.dashboardSummary(
      req.user?.companyId,
      query.startDate,
      query.endDate,
      query.excludeCancelled,
    );
  }
}
