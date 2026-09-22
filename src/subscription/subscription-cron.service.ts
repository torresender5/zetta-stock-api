import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/email/mail.service';
import { TRIAL_END_WARNING_DAYS } from './subscription.constant';

@Injectable()
export class SubscriptionCronService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleExpirations() {
    const now = new Date();

    // 1) Suscripciones que ya pasaron la fecha de corte: marcar vencidas
    //    y notificar por correo.
    const expiredSubs = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        OR: [{ trialEndsAt: { lt: now } }, { expiresAt: { lt: now } }],
      },
      include: {
        plan: true,
        company: { include: { users: { where: { role: 'admin' } } } },
      },
    });
    for (const sub of expiredSubs) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'expired' },
      });
      for (const admin of sub.company.users) {
        try {
          await this.mailService.sendEmail(
            admin.email,
            'Tu plan de ZettaStock ha vencido',
            './subscription_expired',
            {
              name: admin.user,
              plan: sub.plan.name,
              url: 'https://zettastock.com/planes',
            },
          );
        } catch (e) {
          this.logger.error(`No se pudo enviar correo a ${admin.email}: ${e}`);
        }
      }
    }
    if (expiredSubs.length > 0) {
      this.logger.info(
        `Cron: ${expiredSubs.length} suscripciones marcadas como vencidas`,
      );
    }

    // 2) Recordatorios el día anterior al vencimiento (1 día).
    const oneDay = 86400000;
    const lowerBound = new Date(now.getTime() + oneDay);
    const upperBound = new Date(now.getTime() + oneDay * 2);
    await this.sendReminders(lowerBound, upperBound, 'vence mañana');

    // 3) Recordatorios con 7 días restantes.
    const sevenDays = oneDay * TRIAL_END_WARNING_DAYS;
    const sevenLower = new Date(now.getTime() + sevenDays);
    const sevenUpper = new Date(now.getTime() + sevenDays + oneDay);
    await this.sendReminders(sevenLower, sevenUpper, 'vence en 7 días');
  }

  private async sendReminders(from: Date, to: Date, message: string) {
    const subs = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        OR: [
          { trialEndsAt: { gte: from, lt: to } },
          { expiresAt: { gte: from, lt: to } },
        ],
      },
      include: {
        plan: true,
        company: {
          include: { users: { where: { role: 'admin' } } },
        },
      },
    });

    for (const sub of subs) {
      const effectiveEnd = sub.trialEndsAt ?? sub.expiresAt;
      if (!effectiveEnd) continue;
      for (const admin of sub.company.users) {
        try {
          await this.mailService.sendEmail(
            admin.email,
            `Tu plan de ZettaStock ${message}`,
            './subscription_reminder',
            {
              name: admin.user,
              plan: sub.plan.name,
              message,
              date: effectiveEnd.toLocaleDateString('es-CO'),
              url: 'https://zettastock.com/planes',
            },
          );
        } catch (e) {
          this.logger.error(`No se pudo enviar correo a ${admin.email}: ${e}`);
        }
      }
    }
  }
}
