import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendEmail(
    email: string,
    subject: string,
    templatePath: string,
    context: object,
  ) {
    // const url = `example.com/auth/confirm?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: subject,
      template: templatePath, // `.hbs` extension is appended automatically
      context: {
        ...context,
      },
    });
  }
}
