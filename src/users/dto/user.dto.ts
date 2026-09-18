import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsIn,
  MinLength,
} from 'class-validator';

export const USER_ROLES = ['admin', 'vendedor', 'inventario'] as const;
export type UserRole = (typeof USER_ROLES)[number];

@ApiSchema({ name: 'CreateUser' })
export class UserCreateDto {
  @ApiProperty({ description: 'Email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Contraseña' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: 'Nombre de usuario' })
  @IsString()
  user: string;

  @ApiProperty({
    description: 'Rol del usuario',
    enum: USER_ROLES,
  })
  @IsIn(USER_ROLES)
  role: UserRole;
}

@ApiSchema({ name: 'UpdateUser' })
export class UpdateUserDto {
  @ApiProperty({ description: 'Nombre de usuario', required: false })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiProperty({ description: 'Email', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Rol del usuario',
    enum: USER_ROLES,
    required: false,
  })
  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;

  @ApiProperty({ description: 'Nueva contraseña', required: false })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
