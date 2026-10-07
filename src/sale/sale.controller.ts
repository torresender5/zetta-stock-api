import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { AuthUserPayload } from '../auth/auth-user.interface';
import { SaleService } from './sale.service';
import { invoiceToPdf } from './invoice-pdf.util';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import {
  CreateSaleDto,
  ListInvoicesQueryDto,
  ListSalesQueryDto,
  UpdateSaleDto,
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
  findAll(
    @Query() query: ListSalesQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting SaleController find all');
    return this.saleService.findAll(req.user?.companyId, query);
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
    return this.saleService.create(data, req.user?.companyId, req.user.sub);
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
      data.cancelledReason,
      data.refundAmount,
      data.refundMethod,
      data.paymentMethod,
      req.user.sub,
    );
  }

  @AuthRoles('admin', 'vendedor')
  @HttpCode(HttpStatus.OK)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: UpdateSaleDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const saleId = parseInt(id, 10);
    this.logger.info(`Starting SaleController Update Sale: ${saleId}`);
    return this.saleService.update(saleId, data, req.user?.companyId);
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
  findAll(
    @Query() query: ListInvoicesQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting InvoiceController find all');
    return this.saleService.findAllInvoices(req.user?.companyId, query);
  }

  @AuthRoles('admin', 'vendedor')
  @Get('stats')
  stats(
    @Query() query: ListInvoicesQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting InvoiceController stats');
    return this.saleService.invoiceStats(req.user?.companyId, query);
  }

  @AuthRoles('admin', 'vendedor')
  @Get(':id/export')
  @Header('Cache-Control', 'no-store')
  async export(
    @Param('id') id: string,
    @Query('format') format: string | undefined,
    @Req() req: Request & { user: AuthUserPayload },
    // Res no-passthrough: enviar el Buffer directamente evita que Nest lo
    // serialice como JSON {"type":"Buffer"}.
    @Res() res: Response,
  ) {
    const invoiceId = parseInt(id, 10);
    if (format && format !== 'pdf') {
      throw new BadRequestException(
        `Formato no soportado: ${format}. Use "pdf"`,
      );
    }
    this.logger.info(`Starting InvoiceController export PDF: ${invoiceId}`);
    const invoice = await this.saleService.findInvoiceForExport(
      invoiceId,
      req.user?.companyId,
    );
    const buffer = await invoiceToPdf(
      invoice,
      invoice.sale,
      req.user?.companyName,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="factura-${invoice.invoiceNumber}.pdf"`,
    );
    res.send(buffer);
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
      req.user.sub,
    );
  }
}
