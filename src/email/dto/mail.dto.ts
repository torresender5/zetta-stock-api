import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsJSON } from 'class-validator';

@ApiSchema({ name: 'Mail' })
export class SendEmailDto {
  @ApiProperty({ description: 'Email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Subject' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Template Path' })
  @IsString()
  templatePath: string;

  @ApiProperty({ description: 'Context' })
  @IsJSON()
  context: string;
}
