import { ApiProperty, ApiSchema, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

@ApiSchema({ name: 'CreateSaleItem' })
export class CreateSaleItemDto {
  @ApiProperty({ description: 'Product ID' })
  @Type(() => Number)
  @IsNumber()
  productId: number;

  @ApiProperty({ description: 'Product Name' })
  @IsString()
  productName: string;

  @ApiProperty({ description: 'Size', required: false })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiProperty({ description: 'Quantity' })
  @Type(() => Number)
  @IsNumber()
  quantity: number;

  @ApiProperty({ description: 'Unit Price' })
  @Type(() => Number)
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ description: 'Subtotal' })
  @Type(() => Number)
  @IsNumber()
  subtotal: number;
}

@ApiSchema({ name: 'CreateSale' })
export class CreateSaleDto {
  @ApiProperty({ description: 'Client ID' })
  @Type(() => Number)
  @IsNumber()
  clientId: number;

  @ApiProperty({ description: 'Sale Date' })
  @IsString()
  date: string;

  @ApiProperty({ description: 'Sale Items', type: [CreateSaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  @ApiProperty({ description: 'Payment Status', enum: ['paid', 'pending'] })
  @IsString()
  paymentStatus: string;
}

@ApiSchema({ name: 'ListSales' })
export class ListSalesQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

@ApiSchema({ name: 'UpdateSalePaymentStatus' })
export class UpdateSalePaymentStatusDto {
  @ApiProperty({
    description: 'Payment Status',
    enum: ['paid', 'pending', 'cancelled'],
  })
  @IsString()
  @IsIn(['paid', 'pending', 'cancelled'])
  paymentStatus: string;

  @ApiPropertyOptional({ description: 'Cancellation reason' })
  @IsOptional()
  @IsString()
  cancelledReason?: string;

  @ApiPropertyOptional({
    description: 'Refund amount for cancelled paid sales',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  refundAmount?: number;

  @ApiPropertyOptional({
    description: 'Refund method for cancelled paid sales',
  })
  @IsOptional()
  @IsString()
  refundMethod?: string;
}

@ApiSchema({ name: 'UpdateInvoiceStatus' })
export class UpdateInvoiceStatusDto {
  @ApiProperty({ description: 'Invoice Status', enum: ['paid', 'pending'] })
  @IsString()
  status: string;
}
