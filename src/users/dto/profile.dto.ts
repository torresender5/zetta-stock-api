import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  MinLength,
  IsNotEmpty,
} from 'class-validator';

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
}
