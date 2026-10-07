import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from 'src/auth/public.decorator';
import {
  PABILO_SIGNATURE_HEADER,
  PABILO_TIMESTAMP_HEADER,
  STRIPE_SIGNATURE_HEADER,
} from './payment.constant';
import { PaymentService } from './payment.service';

/** Request con el body crudo adjunto (NestFactory.create({ rawBody: true })). */
type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags('Webhooks de pagos')
@Public()
@Controller('webhooks/payments')
export class PaymentWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook de Stripe (checkout completado)' })
  stripeWebhook(
    @Req() req: RawBodyRequest,
    @Headers(STRIPE_SIGNATURE_HEADER) signature?: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Firma ausente');
    }
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Body crudo no disponible');
    }
    return this.paymentService.handleStripeWebhook(rawBody, signature);
  }

  @Post('pabilo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook de Pabilo (pago móvil/transferencia)' })
  pabiloWebhook(
    @Req() req: RawBodyRequest,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Body crudo no disponible');
    }
    return this.paymentService.handlePabiloWebhook(rawBody, {
      [PABILO_TIMESTAMP_HEADER]: headers[PABILO_TIMESTAMP_HEADER],
      [PABILO_SIGNATURE_HEADER]: headers[PABILO_SIGNATURE_HEADER],
    });
  }
}
