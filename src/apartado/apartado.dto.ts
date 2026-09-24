import { ApiProperty, ApiSchema, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

@ApiSchema({ name: 'CreateApartadoItem' })
export class CreateApartadoItemDto {
  @ApiProperty({ description: 'Product ID' })
  @Type(() => Number)
  @IsNumber()
  productId: number;

  @ApiProperty({ description: 'Quantity' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ description: 'Size' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({
    description: 'Unit price (defaults to product sale price)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitPrice?: number;
}

@ApiSchema({ name: 'CreateApartado' })
export class CreateApartadoDto {
  @ApiProperty({ description: 'Client ID' })
  @Type(() => Number)
  @IsNumber()
  clientId: number;

  @ApiProperty({ description: 'Apartado date (YYYY-MM-DD)' })
  @IsString()
  date: string;

  @ApiProperty({ description: 'Apartado items', type: [CreateApartadoItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateApartadoItemDto)
  items: CreateApartadoItemDto[];

  @ApiPropertyOptional({
    description: 'Initial payment (anticipo)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialPayment?: number = 0;

  @ApiPropertyOptional({
    description: 'Payment method for the initial payment',
    enum: ['cash', 'card', 'transfer', 'credit'],
    default: 'cash',
  })
  @IsOptional()
  @IsString()
  initialPaymentMethod?: string = 'cash';

  @ApiPropertyOptional({ description: 'Due date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiSchema({ name: 'AddApartadoPayment' })
export class AddApartadoPaymentDto {
  @ApiProperty({ description: 'Payment amount' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Payment method',
    enum: ['cash', 'card', 'transfer', 'credit'],
    default: 'cash',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string = 'cash';
}

@ApiSchema({ name: 'CancelApartado' })
export class CancelApartadoDto {
  @ApiPropertyOptional({ description: 'Cancellation reason' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Refund method',
    enum: ['cash', 'card', 'transfer'],
    default: 'cash',
  })
  @IsOptional()
  @IsString()
  refundMethod?: string = 'cash';
}

@ApiSchema({ name: 'CompleteApartado' })
export class CompleteApartadoDto {
  @ApiPropertyOptional({
    description: 'Payment method for the outstanding balance',
    enum: ['cash', 'card', 'transfer'],
    default: 'cash',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string = 'cash';
}

@ApiSchema({ name: 'ListApartados' })
export class ListApartadosQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['active', 'paid', 'cancelled'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Search by apartado number or client name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

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
  limit?: number = 10;
}
