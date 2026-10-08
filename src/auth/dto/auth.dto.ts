import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsIn,
  IsBoolean,
} from 'class-validator';

@ApiSchema({ name: 'Login' })
export class CreateLoginDto {
  @ApiProperty({ description: 'Email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password' })
  @IsString()
  password: string;
}

/**
 * Aceptación de los documentos legales (Ley OPDP 1733). Los tres flags son
 * obligatorios: sin ellos no hay prueba de consentimiento ni de mayoría de edad.
 */
export class ConsentFlagsDto {
  @ApiProperty({
    description: 'Acepta los Términos y Condiciones',
    required: true,
  })
  @IsBoolean()
  acceptTerms: boolean;

  @ApiProperty({
    description: 'Acepta la Política de Aviso de Privacidad',
    required: true,
  })
  @IsBoolean()
  acceptPrivacy: boolean;

  @ApiProperty({
    description: 'Declara tener 18 años o más',
    required: true,
  })
  @IsBoolean()
  over18: boolean;
}

@ApiSchema({ name: 'Register' })
export class RegisterDto extends ConsentFlagsDto {
  @ApiProperty({ description: 'Email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password' })
  @IsString()
  password: string;

  @ApiProperty({ description: 'Name' })
  @IsString()
  user: string;

  @ApiProperty({
    description: 'Tipo de cuenta: PERSONA o EMPRESA',
    enum: ['PERSONA', 'EMPRESA'],
  })
  @IsIn(['PERSONA', 'EMPRESA'])
  accountType: 'PERSONA' | 'EMPRESA';

  @ApiProperty({ description: 'Razón social (solo empresa)', required: false })
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

@ApiSchema({ name: 'AcceptLegal' })
export class AcceptLegalDto extends ConsentFlagsDto {}
