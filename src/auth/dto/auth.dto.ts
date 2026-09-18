import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsIn } from 'class-validator';

@ApiSchema({ name: 'Login' })
export class CreateLoginDto {
  @ApiProperty({ description: 'Email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password' })
  @IsString()
  password: string;
}

@ApiSchema({ name: 'Register' })
export class RegisterDto {
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
