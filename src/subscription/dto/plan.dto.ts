import { ApiProperty, ApiSchema, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

@ApiSchema({ name: 'CreatePlan' })
export class CreatePlanDto {
  @ApiProperty({
    description: 'Identificador único del plan (free, basico, pro)',
  })
  @IsString()
  key: string;

  @ApiProperty({ description: 'Nombre mostrado del plan' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Descripción del plan' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Beneficios mostrados en el catálogo',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  features?: string[];

  @ApiProperty({
    description: 'Vistas del frontend permitidas por el plan (ViewKey)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  allowedViews?: string[];

  @ApiProperty({ description: 'Precio mensual en COP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceMonthly?: number;

  @ApiProperty({ description: 'Precio anual en COP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceYearly?: number;

  @ApiProperty({ description: 'Máximo de usuarios permitidos' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @ApiProperty({ description: 'Días de prueba (solo aplica al plan gratis)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiProperty({ description: 'Habilita/deshabilita la visibilidad del plan' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({ description: 'Orden de aparición en el catálogo' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
