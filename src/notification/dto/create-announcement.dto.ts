import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { AnnouncementTargetKind } from '../notification.service';
import { MAX_ANNOUNCEMENT_RECIPIENTS } from '../notification.service';

export const ANNOUNCEMENT_TARGET_KINDS: AnnouncementTargetKind[] = [
  'user',
  'company',
  'all_companies',
  'role',
  'all_users',
];

export const ANNOUNCEMENT_ROLES = ['admin', 'vendedor', 'inventario'] as const;

@ApiSchema({ name: 'AnnouncementTargets' })
export class AnnouncementTargetsDto {
  @ApiProperty({
    description:
      'user = usuarios seleccionados · company = empresas seleccionadas · ' +
      'all_companies = todas las empresas · role = por rol · ' +
      'all_users = todos los usuarios',
    enum: ANNOUNCEMENT_TARGET_KINDS,
  })
  @IsIn(ANNOUNCEMENT_TARGET_KINDS)
  kind: AnnouncementTargetKind;

  @ApiPropertyOptional({
    description: 'IDs de usuarios (requerido cuando kind = "user")',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_ANNOUNCEMENT_RECIPIENTS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  userIds?: number[];

  @ApiPropertyOptional({
    description: 'IDs de empresas (requerido cuando kind = "company")',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_ANNOUNCEMENT_RECIPIENTS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  companyIds?: number[];

  @ApiPropertyOptional({
    description: 'Rol destino (requerido cuando kind = "role")',
    enum: ANNOUNCEMENT_ROLES,
  })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_ROLES)
  role?: string;
}

@ApiSchema({ name: 'CreateAnnouncement' })
export class CreateAnnouncementDto {
  @ApiProperty({
    description: 'Título de la notificación',
    example: 'Mantenimiento programado',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    description: 'Cuerpo de la notificación',
    example:
      'El sábado 2 de noviembre el servicio no estará disponible de 22:00 a 23:00.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @ApiProperty({ description: 'Destinatarios', type: AnnouncementTargetsDto })
  @ValidateNested()
  @Type(() => AnnouncementTargetsDto)
  targets: AnnouncementTargetsDto;
}
