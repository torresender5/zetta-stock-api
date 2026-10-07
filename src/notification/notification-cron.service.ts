import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from './notification.service';

/**
 * Disparadores diarios de notificaciones in-app (Fase 5.3):
 * - Stock bajo (`Product.minStock`, umbral > 0).
 * - Apartados vencidos (`dueDate` pasado con estado `active`).
 * La suscripción por vencer la dispara `SubscriptionCronService` y la
 * apertura de caja `CashRegisterService.open`.
 */
@Injectable()
export class NotificationCronService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { name: 'checkNotificationTriggers' })
  async checkTriggers(): Promise<void> {
    this.logger.info('Notification cron: revisando disparadores');
    await Promise.all([this.checkStockLow(), this.checkOverdueApartados()]);
  }

  async checkStockLow(): Promise<void> {
    try {
      const products = await this.prisma.$queryRaw<
        {
          id: number;
          companyId: number | null;
          name: string;
          stock: number;
          minStock: number;
        }[]
      >`SELECT id, "companyId", name, stock, "minStock"
        FROM "Product"
        WHERE "minStock" > 0 AND stock <= "minStock"`;

      for (const product of products) {
        if (!product.companyId) continue;
        await this.notifications.notify({
          companyId: product.companyId,
          type: 'stock_low',
          title: `Stock bajo: ${product.name}`,
          body: `Quedan ${product.stock} unidades (mínimo configurado: ${product.minStock}).`,
          dedupeKey: `stock_low:${product.id}`,
        });
      }
      if (products.length > 0) {
        this.logger.info(
          `Notification cron: ${products.length} producto(s) con stock bajo`,
        );
      }
    } catch (error) {
      this.logger.error('Notification cron: error revisando stock bajo', error);
    }
  }

  async checkOverdueApartados(): Promise<void> {
    try {
      const apartados = await this.prisma.apartado.findMany({
        where: { status: 'active', dueDate: { lt: new Date() } },
        select: {
          id: true,
          companyId: true,
          apartadoNumber: true,
          dueDate: true,
          total: true,
          totalPaid: true,
          client: { select: { name: true } },
        },
      });

      for (const apartado of apartados) {
        if (!apartado.companyId) continue;
        const pending = Math.max(
          0,
          Math.round((apartado.total - apartado.totalPaid) * 100) / 100,
        );
        await this.notifications.notify({
          companyId: apartado.companyId,
          type: 'apartado_due',
          title: `Apartado vencido: ${apartado.apartadoNumber}`,
          body:
            `${apartado.client.name} · venció el ` +
            `${apartado.dueDate?.toISOString().slice(0, 10)} · ` +
            `saldo pendiente ${pending}.`,
          dedupeKey: `apartado_due:${apartado.id}`,
        });
      }
      if (apartados.length > 0) {
        this.logger.info(
          `Notification cron: ${apartados.length} apartado(s) vencidos`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Notification cron: error revisando apartados vencidos',
        error,
      );
    }
  }
}
