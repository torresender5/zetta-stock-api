import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import type { Request } from 'express';
import { Auth } from 'src/auth/auth.decorator';
import type { AuthUserPayload } from 'src/auth/auth-user.interface';
import { SubscriptionService } from './subscription.service';
import { PurchaseSubscriptionDto } from './dto/purchase.dto';

@ApiTags('Suscripción')
@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Auth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Suscripción actual de la empresa y órdenes de pago',
  })
  @Get('me')
  getMy(@Req() req: Request & { user: AuthUserPayload }) {
    if (!req.user?.companyId) {
      throw new ForbiddenException('Sin empresa asociada');
    }
    this.logger.info('Obteniendo suscripción de la empresa');
    return this.subscriptionService.getMySubscription(req.user.companyId);
  }

  @Auth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Seleccionar plan (gratis se activa, pago genera orden)',
  })
  @Post('purchase')
  purchase(
    @Req() req: Request & { user: AuthUserPayload },
    @Body() dto: PurchaseSubscriptionDto,
  ) {
    if (!req.user?.companyId) {
      throw new ForbiddenException('Sin empresa asociada');
    }
    this.logger.info('Iniciando compra de suscripción');
    return this.subscriptionService.purchase(req.user.companyId, dto);
  }
}
