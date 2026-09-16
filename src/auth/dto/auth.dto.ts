import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail } from 'class-validator';

@ApiSchema({ name: 'Login' })
export class CreateLoginDto {
  @ApiProperty({ description: 'Email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password' })
  @IsString()
  password: string;
}

@ApiSchema({ name: 'Auth' })
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
}
