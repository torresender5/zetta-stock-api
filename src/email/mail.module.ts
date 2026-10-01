import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { join } from 'path';
import { EmailController } from './mail.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

const hasSmtpConfig = !!(
  process.env.MAIL_HOST &&
  process.env.MAIL_USER &&
  process.env.MAIL_PASSWORD
);

if (!hasSmtpConfig) {
  console.warn(
    '[mail] SMTP no configurado (MAIL_HOST, MAIL_USER, MAIL_PASSWORD). ' +
      'Los correos fallarán al enviarse hasta que se configure.',
  );
}

@Module({
  imports: [
    PrismaModule,
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST ?? 'localhost',
        port: Number(process.env.MAIL_PORT ?? 25),
        secure: false,
        auth: {
          user: process.env.MAIL_USER ?? '',
          pass: process.env.MAIL_PASSWORD ?? '',
        },
      },
      defaults: {
        from: process.env.MAIL_FROM ?? '"ZettaStock" <no-reply@zettastock.com>',
      },
      template: {
        dir: join(__dirname, 'templates'),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
  ],
  controllers: [EmailController],
  providers: [MailService],
  exports: [MailService], // 👈 export for DI
})
export class MailModule {}
