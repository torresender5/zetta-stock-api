import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

@ApiSchema({ name: 'CreateSaleItem' })
export class CreateSaleItemDto {
    @ApiProperty({ description: 'Product ID' })
    @Type(() => Number)
    @IsNumber()
    productId: number;

    @ApiProperty({ description: 'Product Name' })
    @IsString()
    productName: string;

    @ApiProperty({ description: 'Size', required: false })
    @IsOptional()
    @IsString()
    size?: string;

    @ApiProperty({ description: 'Quantity' })
    @Type(() => Number)
    @IsNumber()
    quantity: number;

    @ApiProperty({ description: 'Unit Price' })
    @Type(() => Number)
    @IsNumber()
    unitPrice: number;

    @ApiProperty({ description: 'Subtotal' })
    @Type(() => Number)
    @IsNumber()
    subtotal: number;
}

@ApiSchema({ name: 'CreateSale' })
export class CreateSaleDto {
    @ApiProperty({ description: 'Client ID' })
    @Type(() => Number)
    @IsNumber()
    clientId: number;

    @ApiProperty({ description: 'Sale Date' })
    @IsString()
    date: string;

    @ApiProperty({ description: 'Sale Items', type: [CreateSaleItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSaleItemDto)
    items: CreateSaleItemDto[];

    @ApiProperty({ description: 'Payment Status', enum: ['paid', 'pending'] })
    @IsString()
    paymentStatus: string;
}

@ApiSchema({ name: 'UpdateSalePaymentStatus' })
export class UpdateSalePaymentStatusDto {
    @ApiProperty({ description: 'Payment Status', enum: ['paid', 'pending'] })
    @IsString()
    paymentStatus: string;
}

@ApiSchema({ name: 'UpdateInvoiceStatus' })
export class UpdateInvoiceStatusDto {
    @ApiProperty({ description: 'Invoice Status', enum: ['paid', 'pending'] })
    @IsString()
    status: string;
}
