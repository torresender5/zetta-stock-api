import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

@ApiSchema({ name: 'CreateCategory' })
export class CategoryCreateDto {
  @ApiProperty({ description: 'Nombre de la categoría' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Código de la categoría (se autogenera si se omite)',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Descripción de la categoría' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCategoryDto extends PartialType(CategoryCreateDto) {}

@ApiSchema({ name: 'CategoryQuery' })
export class CategoryQueryDto {
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

  @ApiPropertyOptional({ description: 'Search by name or code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by creation start date (ISO 8601)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by creation end date (ISO 8601)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
