import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { User } from '../users/interface/user.interface';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendUserConfirmation(user: User, token: string) {
    const url = `example.com/auth/confirm?token=${token}`;

    await this.mailerService.sendMail({
      to: 'torresender5@gmail.com',
      // from: '"Support Team" <support@example.com>', // override default from
      subject: 'Welcome to Nice App! Confirm your Email',
      template: './confirmation', // `.hbs` extension is appended automatically
      context: {
        // ✏️ filling curly brackets with content
        name: 'Ender Torres',
        url,
      },
    });
  }

  async sendEmail(
    email: string,
    subject: string,
    templatePath: string,
    context: object,
  ) {
    // const url = `example.com/auth/confirm?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      // from: '"Support Team" <support@example.com>', // override default from
      subject: subject,
      template: templatePath, // `.hbs` extension is appended automatically
      context: {
        // ✏️ filling curly brackets with content
        ...context,
      },
    });
  }
}
