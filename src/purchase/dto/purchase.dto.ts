import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

@ApiSchema({ name: 'CreatePurchaseItem' })
export class CreatePurchaseItemDto {
  @ApiProperty({ description: 'Product ID' })
  @Type(() => Number)
  @IsNumber()
  productId: number;

  @ApiPropertyOptional({ description: 'Size for products with sizes' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiProperty({ description: 'Product Name' })
  @IsString()
  productName: string;

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

@ApiSchema({ name: 'CreatePurchase' })
export class CreatePurchaseDto {
  @ApiProperty({ description: 'Supplier ID' })
  @Type(() => Number)
  @IsNumber()
  supplierId: number;

  @ApiProperty({ description: 'Purchase Date' })
  @IsString()
  date: string;

  @ApiProperty({ description: 'Purchase Items', type: [CreatePurchaseItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items: CreatePurchaseItemDto[];

  @ApiProperty({ description: 'Payment Status', enum: ['paid', 'pending'] })
  @IsString()
  paymentStatus: string;
}

@ApiSchema({ name: 'UpdatePurchasePaymentStatus' })
export class UpdatePurchasePaymentStatusDto {
  @ApiProperty({ description: 'Payment Status', enum: ['paid', 'pending'] })
  @IsString()
  paymentStatus: string;
}

@ApiSchema({ name: 'PurchaseQuery' })
export class PurchaseQueryDto {
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

  @ApiPropertyOptional({
    description: 'Search by supplier name or product name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by supplier ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: ['paid', 'pending'],
  })
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @ApiPropertyOptional({
    description: 'Filter by start date (ISO 8601)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by end date (ISO 8601)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
