import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, MinLength } from 'class-validator';

export const DATA_SUBJECT_TYPES = [
  'acceso',
  'rectificacion',
  'supresion',
  'revocacion',
] as const;

export type DataSubjectType = (typeof DATA_SUBJECT_TYPES)[number];

/** Normaliza acentos/mayúsculas: «Supresión» y «supresion» son el mismo tipo. */
const normalizeType = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
    : value;

@ApiSchema({ name: 'DataSubjectRequest' })
export class CreateDataSubjectRequestDto {
  @ApiProperty({
    description:
      'Derecho ARCO ejercido: acceso | rectificacion | supresion | revocacion',
    enum: DATA_SUBJECT_TYPES,
  })
  @Transform(normalizeType)
  @IsIn(DATA_SUBJECT_TYPES as unknown as string[])
  type: DataSubjectType;

  @ApiProperty({
    description:
      'Motivo y descripción de los datos a los que se refiere la solicitud',
  })
  @IsString()
  @MinLength(10)
  motivo: string;
}
