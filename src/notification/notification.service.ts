import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from 'src/prisma/prisma.service';

export type NotificationType =
  | 'stock_low'
  | 'apartado_due'
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'cash_open';

export interface NotifyInput {
  companyId?: number | null;
  userId?: number | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  /** Evita duplicados mientras la notificación siga sin leer. */
  dedupeKey?: string | null;
}

export interface ListNotificationsQuery {
  page?: number;
  limit?: number;
  unread?: boolean;
}

@Injectable()
export class NotificationService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  /**
   * Crea una notificación in-app. Nunca lanza: los fallos aquí no deben
   * romper el flujo de negocio que la desencadena.
   */
  async notify(input: NotifyInput): Promise<void> {
    if (!input.companyId) {
      return;
    }
    try {
      if (input.dedupeKey) {
        const existing = await this.prisma.notification.findFirst({
          where: {
            companyId: input.companyId,
            dedupeKey: input.dedupeKey,
            readAt: null,
          },
          select: { id: true },
        });
        if (existing) {
          return;
        }
      }
      await this.prisma.notification.create({
        data: {
          companyId: input.companyId,
          userId: input.userId ?? null,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          dedupeKey: input.dedupeKey ?? null,
        },
      });
    } catch (error) {
      this.logger.error('Error creating notification:', error);
    }
  }

  async list(
    companyId: number | undefined,
    query: ListNotificationsQuery = {},
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where = {
      ...(companyId ? { companyId } : { id: -1 }),
      ...(query.unread ? { readAt: null } : {}),
    };

    const [data, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          ...(companyId ? { companyId } : { id: -1 }),
          readAt: null,
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      unread,
    };
  }

  async markRead(id: number, companyId?: number) {
    const existing = await this.prisma.notification.findFirst({
      where: companyId ? { id, companyId } : { id: -1 },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Notificación no encontrada');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(companyId?: number) {
    if (!companyId) {
      return { count: 0 };
    }
    const result = await this.prisma.notification.updateMany({
      where: { companyId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count: result.count };
  }

  /** Elimina notificaciones no leídas de un tipo (estado que ya no aplica). */
  async clearUnreadByType(
    companyId: number | undefined,
    type: NotificationType,
  ): Promise<void> {
    if (!companyId) {
      return;
    }
    try {
      await this.prisma.notification.deleteMany({
        where: { companyId, type, readAt: null },
      });
    } catch (error) {
      this.logger.error('Error clearing notifications:', error);
    }
  }
}
