import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { SUBSCRIPTION_PERIODS } from '../subscription.constant';
import { PAYMENT_PROVIDERS } from 'src/payment/payment.constant';

@ApiSchema({ name: 'PurchaseSubscription' })
export class PurchaseSubscriptionDto {
  @ApiProperty({ description: 'ID del plan a contratar' })
  @IsInt()
  planId: number;

  @ApiProperty({
    description: 'Período de facturación',
    enum: SUBSCRIPTION_PERIODS,
  })
  @IsIn(SUBSCRIPTION_PERIODS)
  period: 'monthly' | 'yearly';

  @ApiPropertyOptional({
    description:
      'Proveedor de pago para iniciar el checkout online. "manual" (default) solo genera la orden pendiente de confirmación.',
    enum: PAYMENT_PROVIDERS,
  })
  @IsOptional()
  @IsIn(PAYMENT_PROVIDERS)
  provider?: 'stripe' | 'pabilo' | 'manual';
}
