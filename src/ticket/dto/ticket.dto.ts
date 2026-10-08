import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const TICKET_CATEGORIES = ['consulta', 'pago', 'falla', 'otro'] as const;
export const TICKET_STATUSES = [
  'abierto',
  'pendiente',
  'en_proceso',
  'finalizado',
] as const;
/** Estados que la empresa puede fijar: cerrar o reabrir su propio ticket. */
export const COMPANY_TICKET_STATUSES = ['finalizado', 'abierto'] as const;
/** Estados que el soporte puede fijar: atender, pedir info o cerrar. */
export const SUPPORT_TICKET_STATUSES = [
  'pendiente',
  'en_proceso',
  'finalizado',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

@ApiSchema({ name: 'CreateTicket' })
export class TicketCreateDto {
  @ApiProperty({
    description: 'Asunto del ticket',
    example: 'Error al facturar',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  subject: string;

  @ApiProperty({
    description: 'Categoría del ticket',
    enum: TICKET_CATEGORIES,
    example: 'falla',
  })
  @IsIn(TICKET_CATEGORIES)
  category: (typeof TICKET_CATEGORIES)[number];

  @ApiProperty({
    description: 'Detalle del mensaje inicial',
    example: 'Adjunto captura del pago de la suscripción',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;
}

@ApiSchema({ name: 'TicketMessage' })
export class TicketMessageDto {
  @ApiProperty({ description: 'Contenido del mensaje' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;
}

@ApiSchema({ name: 'CompanyTicketStatus' })
export class CompanyTicketStatusDto {
  @ApiProperty({
    description: 'Nuevo estado del ticket (la empresa cierra o reabre)',
    enum: COMPANY_TICKET_STATUSES,
  })
  @IsIn(COMPANY_TICKET_STATUSES)
  status: (typeof COMPANY_TICKET_STATUSES)[number];
}

@ApiSchema({ name: 'SupportTicketStatus' })
export class SupportTicketStatusDto {
  @ApiProperty({
    description: 'Nuevo estado del ticket (el soporte gestiona el ciclo)',
    enum: SUPPORT_TICKET_STATUSES,
  })
  @IsIn(SUPPORT_TICKET_STATUSES)
  status: (typeof SUPPORT_TICKET_STATUSES)[number];
}

@ApiSchema({ name: 'TicketQuery' })
export class TicketQueryDto {
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

  @ApiPropertyOptional({ description: 'Search by subject or message body' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: TICKET_STATUSES,
  })
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: TicketStatus;
}

@ApiSchema({ name: 'AdminTicketQuery' })
export class AdminTicketQueryDto extends TicketQueryDto {
  @ApiPropertyOptional({ description: 'Filter by company id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId?: number;
}
