import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsString, IsEmail, IsJSON, IsIn } from 'class-validator';
import { ALLOWED_MAIL_TEMPLATES } from '../mail.constant';

@ApiSchema({ name: 'Mail' })
export class SendEmailDto {
  @ApiProperty({ description: 'Email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Subject' })
  @IsString()
  subject: string;

  @ApiProperty({
    description: 'Template Path (solo plantillas permitidas)',
    enum: [...ALLOWED_MAIL_TEMPLATES],
  })
  @IsIn([...ALLOWED_MAIL_TEMPLATES])
  @IsString()
  templatePath: string;

  @ApiProperty({ description: 'Context' })
  @IsJSON()
  context: string;
}
