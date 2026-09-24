import { ApiProperty, ApiSchema, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

@ApiSchema({ name: 'CreateClient' })
export class ClientCreateDto {
  @ApiProperty({ description: 'Name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Phone' })
  @IsString()
  phone: string;

  @ApiProperty({ description: 'Address' })
  @IsString()
  address: string;

  @ApiProperty({ description: 'Document' })
  @IsString()
  document: string;

  @ApiProperty({ description: 'Email' })
  @IsEmail()
  email: string;
}

export class UpdateClientDto extends PartialType(ClientCreateDto) {}

@ApiSchema({ name: 'ClientQuery' })
export class ClientQueryDto {
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
