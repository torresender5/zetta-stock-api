import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';
import { SUBSCRIPTION_PERIODS } from '../subscription.constant';

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
}
