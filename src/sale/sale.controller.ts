import {
  Controller,
  Get,
  Post,
  Patch,
  HttpCode,
  HttpStatus,
  Body,
  Param,
  Inject,
  Req,
} from '@nestjs/common';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { AuthUserPayload } from '../auth/auth-user.interface';
import { SaleService } from './sale.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import {
  CreateSaleDto,
  UpdateSalePaymentStatusDto,
  UpdateInvoiceStatusDto,
} from './dto/sale.dto';

@Controller('sales')
export class SaleController {
  constructor(
    private saleService: SaleService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @AuthRoles('admin', 'vendedor')
  @Get()
  findAll(@Req() req: Request & { user: AuthUserPayload }) {
    this.logger.info('Starting SaleController find all');
    return this.saleService.findAll(req.user?.companyId);
  }

  @AuthRoles('admin', 'vendedor')
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const saleId = parseInt(id, 10);
    this.logger.info(`Starting SaleController find By ID: ${saleId}`);
    return this.saleService.findById(saleId, req.user?.companyId);
  }

  @AuthRoles('admin', 'vendedor')
  @HttpCode(HttpStatus.OK)
  @Post()
  create(
    @Body() data: CreateSaleDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting SaleController Create Sale');
    return this.saleService.create(data, req.user?.companyId);
  }

  @AuthRoles('admin', 'vendedor')
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  updatePaymentStatus(
    @Param('id') id: string,
    @Body() data: UpdateSalePaymentStatusDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const saleId = parseInt(id, 10);
    this.logger.info(
      `Starting SaleController Update Payment Status: ${saleId}`,
    );
    return this.saleService.updatePaymentStatus(
      saleId,
      data.paymentStatus,
      req.user?.companyId,
    );
  }
}

@Controller('invoices')
export class InvoiceController {
  constructor(
    private saleService: SaleService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @AuthRoles('admin', 'vendedor')
  @Get()
  findAll(@Req() req: Request & { user: AuthUserPayload }) {
    this.logger.info('Starting InvoiceController find all');
    return this.saleService.findAllInvoices(req.user?.companyId);
  }

  @AuthRoles('admin', 'vendedor')
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  updateStatus(
    @Param('id') id: string,
    @Body() data: UpdateInvoiceStatusDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const invoiceId = parseInt(id, 10);
    this.logger.info(`Starting InvoiceController Update Status: ${invoiceId}`);
    return this.saleService.updateInvoiceStatus(
      invoiceId,
      data.status,
      req.user?.companyId,
    );
  }
}
