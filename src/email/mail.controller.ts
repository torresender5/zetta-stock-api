import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Auth } from '../auth/auth.decorator';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { MailService } from './mail.service';
import { SendEmailDto } from './dto/mail.dto';

@Controller('mail')
export class EmailController {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private mailService: MailService,
  ) {}

  @Auth()
  @HttpCode(HttpStatus.OK)
  @Post('send')
  sendEmail(@Body() data: SendEmailDto) {
    this.logger.info('Starting EmailController sendEmail');
    const context = JSON.parse(data.context);
    return this.mailService.sendEmail(
      data.email,
      data.subject,
      data.templatePath,
      context,
    );
  }
}
