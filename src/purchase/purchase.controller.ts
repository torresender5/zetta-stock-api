import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  Body,
  Param,
  Query,
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
  UpdatePurchaseDto,
  PurchaseQueryDto,
} from './dto/purchase.dto';

@Controller('purchases')
export class PurchaseController {
  constructor(
    private purchaseService: PurchaseService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @AuthRoles('admin', 'inventario')
  @Get()
  findAll(
    @Query() query: PurchaseQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting PurchaseController find all');
    return this.purchaseService.findAll(query, req.user?.companyId);
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
  update(
    @Param('id') id: string,
    @Body() data: UpdatePurchaseDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const purchaseId = parseInt(id, 10);
    this.logger.info(
      `Starting PurchaseController Update Purchase: ${purchaseId}`,
    );
    return this.purchaseService.update(purchaseId, data, req.user?.companyId);
  }

  @AuthRoles('admin', 'inventario')
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const purchaseId = parseInt(id, 10);
    this.logger.info(
      `Starting PurchaseController Delete Purchase: ${purchaseId}`,
    );
    return this.purchaseService.remove(purchaseId, req.user?.companyId);
  }
}
