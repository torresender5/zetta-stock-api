import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

export class ProductSizeDto {
  @ApiProperty({ description: 'Size label (e.g. S, M, L, 38)' })
  @IsString()
  size: string;

  @ApiProperty({ description: 'Stock available for this size' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
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
  @Type(() => Number)
  purchasePrice: number;

  @ApiProperty({ description: 'Product Sale Price' })
  @IsNumber()
  @Type(() => Number)
  salePrice: number;

  @ApiProperty({ description: 'Product Stock' })
  @IsNumber()
  @Type(() => Number)
  stock: number;

  @ApiPropertyOptional({
    description: 'Stock mínimo para alertas de stock bajo (0 = sin alerta)',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minStock?: number;

  @ApiProperty({ description: 'Product SKU' })
  @IsString()
  sku: string;

  @ApiPropertyOptional({
    description:
      'Código de barras escaneado (EAN/UPC/Code128). Debe ser único por empresa',
  })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({ description: 'Product Type' })
  @IsString()
  type: string;

  @ApiPropertyOptional({
    description:
      'Product Category (nombre). Si se envía categoryId, el nombre se toma de la categoría',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Category ID (FK a Category). Tiene prioridad sobre category',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;

  @ApiProperty({ description: 'Product Image URL' })
  @IsOptional()
  @IsString()
  image?: string | null;

  @ApiProperty({
    description: 'Product sizes with stock per size',
    type: [ProductSizeDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  @Type(() => ProductSizeDto)
  sizes: ProductSizeDto[];
}

export class UpdateProductDto extends PartialType(ProductCreateDto) {}
