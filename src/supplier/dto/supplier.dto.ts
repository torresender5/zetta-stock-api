import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

@ApiSchema({ name: 'CreateSupplier' })
export class SupplierCreateDto {
  @ApiProperty({ description: 'Supplier Name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Supplier Document (NIT or Cedula)' })
  @IsString()
  document: string;

  @ApiProperty({ description: 'Supplier Email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Supplier Phone' })
  @IsString()
  phone: string;

  @ApiProperty({ description: 'Supplier Address' })
  @IsString()
  address: string;
}

export class UpdateSupplierDto extends PartialType(SupplierCreateDto) {}

@ApiSchema({ name: 'SupplierQuery' })
export class SupplierQueryDto {
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
    description: 'Search by name, document, email or phone',
  })
  @IsOptional()
  @IsString()
  search?: string;

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
