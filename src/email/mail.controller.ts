import {
  Controller,
  Get,
  Post,
  UseGuards,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
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
  // private readonly logger = new Logger(UsersController.name);

  // @UseGuards(AuthGuard)
  @Post('send')
  sendEmail(@Body() data: SendEmailDto) {
    this.logger.info('Starting EmailController sendEmail');
    const context = JSON.parse(data.context);
    this.mailService.sendEmail(
      data.email,
      data.subject,
      data.templatePath,
      context,
    );
    // this.logger.log('Starting UsersController find all')
    // return this.usersService.findAllUsers()
  }
}
