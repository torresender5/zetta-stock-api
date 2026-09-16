import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

@ApiSchema({ name: 'CreateClient' })
export class ClientCreateDto {
  @ApiProperty({ description: 'Name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Phone' })
  @IsString()
  phone: string;

  @ApiProperty({ description: 'Address' })
  @IsString()
  address: string;

  @ApiProperty({ description: 'Document' })
  @IsString()
  document: string;

  @ApiProperty({ description: 'Email' })
  @IsEmail()
  email: string;
}

export class UpdateClientDto extends PartialType(ClientCreateDto) {}
