import { ApiProperty, ApiSchema, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'credit'];

@ApiSchema({ name: 'OpenCashRegister' })
export class OpenCashRegisterDto {
  @ApiProperty({ description: 'Monto base de apertura en COP' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseAmount: number;

  @ApiPropertyOptional({ description: 'Nombre personalizado de la caja' })
  @IsOptional()
  @IsString()
  name?: string;
}

@ApiSchema({ name: 'CreateCashMovement' })
export class CreateCashMovementDto {
  @ApiProperty({
    description: 'Tipo de movimiento',
    enum: ['expense', 'withdrawal', 'deposit'],
  })
  @IsIn(['expense', 'withdrawal', 'deposit'])
  type: 'expense' | 'withdrawal' | 'deposit';

  @ApiProperty({
    description: 'Medio de pago',
    enum: PAYMENT_METHODS,
    default: 'cash',
  })
  @IsIn(PAYMENT_METHODS)
  paymentMethod: string;

  @ApiProperty({ description: 'Monto en COP (siempre positivo)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: 'Descripción / motivo' })
  @IsOptional()
  @IsString()
  description?: string;
}

@ApiSchema({ name: 'CloseCashRegister' })
export class CloseCashRegisterDto {
  @ApiPropertyOptional({
    description: 'Conteo físico en efectivo (COP)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cash?: number = 0;

  @ApiPropertyOptional({
    description: 'Conteo por tarjeta (COP)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  card?: number = 0;

  @ApiPropertyOptional({
    description: 'Conteo por transferencia (COP)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transfer?: number = 0;

  @ApiPropertyOptional({
    description: 'Conteo por crédito / cuentas por cobrar (COP)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  credit?: number = 0;
}

@ApiSchema({ name: 'ListCashRegisters' })
export class ListCashRegistersQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: ['open', 'closed'],
  })
  @IsOptional()
  @IsIn(['open', 'closed'])
  status?: 'open' | 'closed';

  @ApiPropertyOptional({ description: 'Página (base 1)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Elementos por página', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
