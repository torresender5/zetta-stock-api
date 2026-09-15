import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

@ApiSchema({ name: 'CreatePurchaseItem' })
export class CreatePurchaseItemDto {
    @ApiProperty({ description: 'Product ID' })
    @Type(() => Number)
    @IsNumber()
    productId: number;

    @ApiProperty({ description: 'Product Name' })
    @IsString()
    productName: string;

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

@ApiSchema({ name: 'CreatePurchase' })
export class CreatePurchaseDto {
    @ApiProperty({ description: 'Supplier ID' })
    @Type(() => Number)
    @IsNumber()
    supplierId: number;

    @ApiProperty({ description: 'Purchase Date' })
    @IsString()
    date: string;

    @ApiProperty({ description: 'Purchase Items', type: [CreatePurchaseItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreatePurchaseItemDto)
    items: CreatePurchaseItemDto[];

    @ApiProperty({ description: 'Payment Status', enum: ['paid', 'pending'] })
    @IsString()
    paymentStatus: string;
}

@ApiSchema({ name: 'UpdatePurchasePaymentStatus' })
export class UpdatePurchasePaymentStatusDto {
    @ApiProperty({ description: 'Payment Status', enum: ['paid', 'pending'] })
    @IsString()
    paymentStatus: string;
}
