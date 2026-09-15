import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsString, IsEmail } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

@ApiSchema({ name: 'CreateSupplier' })
export class SupplierCreateDto {
    @ApiProperty({ description: 'Supplier Name' })
    @IsString()
    name: string;

    @ApiProperty({ description: 'Supplier Document (NIT or Cedula)' })
    @IsString()
    document: string;

    @ApiProperty({ description: 'Supplier Email' })
    @IsEmail()
    email: string;

    @ApiProperty({ description: 'Supplier Phone' })
    @IsString()
    phone: string;

    @ApiProperty({ description: 'Supplier Address' })
    @IsString()
    address: string;
}

export class UpdateSupplierDto extends PartialType(SupplierCreateDto) {}
