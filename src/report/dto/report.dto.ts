import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsIn } from 'class-validator';

@ApiSchema({ name: 'ReportQuery' })
export class ReportQueryDto {
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

  @ApiPropertyOptional({
    description: 'Formato de exportación opcional',
    enum: ['xlsx', 'pdf'],
  })
  @IsOptional()
  @IsIn(['xlsx', 'pdf'])
  export?: 'xlsx' | 'pdf';
}

@ApiSchema({ name: 'PaymentsReportQuery' })
export class PaymentsReportQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado de pago',
    enum: ['paid', 'pending'],
  })
  @IsOptional()
  @IsIn(['paid', 'pending'])
  status?: 'paid' | 'pending';
}
