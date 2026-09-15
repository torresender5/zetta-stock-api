import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

export class ProductSizeDto {
    @ApiProperty({ description: 'Size label (e.g. S, M, L, 38)' })
    @IsString()
    size: string;

    @ApiProperty({ description: 'Stock available for this size' })
    @IsOptional()
    @IsNumber()
    stock?: number;
}


@ApiSchema({ name: 'CreateProduct' })
export class ProductCreateDto {

    @ApiProperty({ description: 'Product Name' })
    @IsString()
    name: string;

    @ApiProperty({ description: 'Product Description' })
    @IsOptional()
    @IsString()
    description: string;

    @ApiProperty({ description: 'Product Code' })
    @IsString()
    code: string;

    @ApiProperty({ description: 'Product Purchase Price' })
    @IsNumber()
    purchasePrice: number;

    @ApiProperty({ description: 'Product Sale Price' })
    @IsNumber()
    salePrice: number;

    @ApiProperty({ description: 'Product Stock' })
    @IsNumber()
    stock: number;

    @ApiProperty({ description: 'Product SKU' })
    @IsString()
    sku: string;
    
    @ApiProperty({ description: 'Product Type' })
    @IsString()
    type: string;

    @ApiProperty({ description: 'Product Category' })
    @IsString()
    category: string;

    @ApiProperty({ description: 'Product Image URL' })
    @IsOptional()
    @IsString()
    image: string;

    @ApiProperty({ description: 'Product sizes with stock per size', type: [ProductSizeDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ProductSizeDto)
    sizes: ProductSizeDto[];
}

export class UpdateProductDto extends PartialType(ProductCreateDto) {}