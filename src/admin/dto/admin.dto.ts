import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional, IsString } from 'class-validator';

@ApiSchema({ name: 'AdminStatus' })
export class AdminStatusDto {
  @ApiProperty({ description: 'Nuevo estado activo de la entidad' })
  @IsBoolean()
  active: boolean;
}

@ApiSchema({ name: 'AdminListQuery' })
export class AdminListQueryDto {
  @ApiPropertyOptional({
    description: 'Filtro de búsqueda por nombre, email o empresa',
    example: 'zetta',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

@ApiSchema({ name: 'AdminBusinessQuery' })
export class AdminBusinessQueryDto {
  @ApiPropertyOptional({
    description: 'Fecha inicial del rango (ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha final del rango (ISO 8601)',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
