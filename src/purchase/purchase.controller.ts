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

  @AuthRoles('admin', 'inventario')
  @Get()
  findAll(@Req() req: Request & { user: AuthUserPayload }) {
    this.logger.info('Starting PurchaseController find all');
    return this.purchaseService.findAll(req.user?.companyId);
  }

  @AuthRoles('admin', 'inventario')
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const purchaseId = parseInt(id, 10);
    this.logger.info(`Starting PurchaseController find By ID: ${purchaseId}`);
    return this.purchaseService.findById(purchaseId, req.user?.companyId);
  }

  @AuthRoles('admin', 'inventario')
  @HttpCode(HttpStatus.OK)
  @Post()
  create(
    @Body() data: CreatePurchaseDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting PurchaseController Create Purchase');
    return this.purchaseService.create(data, req.user?.companyId);
  }

  @AuthRoles('admin', 'inventario')
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  updatePaymentStatus(
    @Param('id') id: string,
    @Body() data: UpdatePurchasePaymentStatusDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const purchaseId = parseInt(id, 10);
    this.logger.info(
      `Starting PurchaseController Update Payment Status: ${purchaseId}`,
    );
    return this.purchaseService.updatePaymentStatus(
      purchaseId,
      data.paymentStatus,
      req.user?.companyId,
    );
  }
}
