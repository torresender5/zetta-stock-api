import { Controller, Get, Post, Patch, UseGuards, HttpCode, HttpStatus, Body, Param, Inject} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { SaleService } from './sale.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { CreateSaleDto, UpdateSalePaymentStatusDto, UpdateInvoiceStatusDto } from './dto/sale.dto';

@Controller('sales')
export class SaleController {
    constructor(private saleService: SaleService, @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}
    
    @UseGuards(AuthGuard)
    @Get()
    findAll(){
        this.logger.info('Starting SaleController find all')
        return this.saleService.findAll()
    }

    @UseGuards(AuthGuard)
    @Get(':id')
    findOne(@Param('id') id: string){
        const saleId = parseInt(id, 10);
        this.logger.info(`Starting SaleController find By ID: ${saleId}`)
        return this.saleService.findById(saleId)
    }
    
    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post()
    create(@Body() data: CreateSaleDto) {
        this.logger.info('Starting SaleController Create Sale')
        return this.saleService.create(data);
    }

    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    @Patch(':id')
    updatePaymentStatus(@Param('id') id: string, @Body() data: UpdateSalePaymentStatusDto) {
        const saleId = parseInt(id, 10);
        this.logger.info(`Starting SaleController Update Payment Status: ${saleId}`)
        return this.saleService.updatePaymentStatus(saleId, data.paymentStatus);
    }
}

@Controller('invoices')
export class InvoiceController {
    constructor(private saleService: SaleService, @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}
    
    @UseGuards(AuthGuard)
    @Get()
    findAll(){
        this.logger.info('Starting InvoiceController find all')
        return this.saleService.findAllInvoices()
    }

    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    @Patch(':id')
    updateStatus(@Param('id') id: string, @Body() data: UpdateInvoiceStatusDto) {
        const invoiceId = parseInt(id, 10);
        this.logger.info(`Starting InvoiceController Update Status: ${invoiceId}`)
        return this.saleService.updateInvoiceStatus(invoiceId, data.status);
    }
}
