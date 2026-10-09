import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

@ApiSchema({ name: 'ListNotifications' })
export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ description: 'Página', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Resultados por página', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Solo no leídas', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unread?: boolean;

  @ApiPropertyOptional({
    description:
      'Alcance: "general" excluye las de tickets, "tickets" solo las de ' +
      'tickets (ticket_reply), "all" muestra todo',
    enum: ['all', 'general', 'tickets'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'general', 'tickets'])
  scope?: 'all' | 'general' | 'tickets';
}
