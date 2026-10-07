import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  MinLength,
  IsNotEmpty,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

@ApiSchema({ name: 'UpdateProfile' })
export class UpdateProfileDto {
  @ApiProperty({ description: 'Nombre', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Email', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Contraseña actual (obligatoria para confirmar cambios)',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ description: 'Nueva contraseña (opcional)', required: false })
  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;
}

@ApiSchema({ name: 'UpdateCompany' })
export class UpdateCompanyDto {
  @ApiProperty({ description: 'Razón social / nombre', required: false })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ description: 'Documento / NIT', required: false })
  @IsOptional()
  @IsString()
  document?: string;

  @ApiProperty({ description: 'Teléfono', required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ description: 'Dirección', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'Moneda base de la empresa',
    enum: ['USD', 'VES'],
    required: false,
  })
  @IsOptional()
  @IsIn(['USD', 'VES'])
  currency?: 'USD' | 'VES';

  @ApiProperty({
    description: 'Porcentaje de IVA (0-100)',
    required: false,
    example: 19,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiProperty({
    description: 'Prefijo de numeración de facturas',
    required: false,
    example: 'FAC',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  invoicePrefix?: string;

  @ApiProperty({
    description: 'Prefijo de numeración de ventas',
    required: false,
    example: 'VEN',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  salePrefix?: string;
}
