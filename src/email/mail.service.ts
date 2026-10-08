import { MailerService } from '@nestjs-modules/mailer';
import { BadRequestException, Injectable } from '@nestjs/common';
import { isAllowedMailTemplate } from './mail.constant';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendEmail(
    email: string,
    subject: string,
    templatePath: string,
    context: object,
  ) {
    // Ninguna ruta de plantilla arbitraria (Fase 4 del PLAN_LEGAL.md).
    if (!isAllowedMailTemplate(templatePath)) {
      throw new BadRequestException('Plantilla de correo no permitida.');
    }

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
