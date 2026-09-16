import {
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
  Param,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PurchaseService } from './purchase.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import {
  CreatePurchaseDto,
  UpdatePurchasePaymentStatusDto,
} from './dto/purchase.dto';

@Controller('purchases')
export class PurchaseController {
  constructor(
    private purchaseService: PurchaseService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @UseGuards(AuthGuard)
  @Get()
  findAll() {
    this.logger.info('Starting PurchaseController find all');
    return this.purchaseService.findAll();
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    const purchaseId = parseInt(id, 10);
    this.logger.info(`Starting PurchaseController find By ID: ${purchaseId}`);
    return this.purchaseService.findById(purchaseId);
  }

  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post()
  create(@Body() data: CreatePurchaseDto) {
    this.logger.info('Starting PurchaseController Create Purchase');
    return this.purchaseService.create(data);
  }

  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  updatePaymentStatus(
    @Param('id') id: string,
    @Body() data: UpdatePurchasePaymentStatusDto,
  ) {
    const purchaseId = parseInt(id, 10);
    this.logger.info(
      `Starting PurchaseController Update Payment Status: ${purchaseId}`,
    );
    return this.purchaseService.updatePaymentStatus(
      purchaseId,
      data.paymentStatus,
    );
  }
}
