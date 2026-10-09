import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from 'src/prisma/prisma.service';

export type NotificationType =
  | 'stock_low'
  | 'apartado_due'
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'cash_open'
  | 'ticket_reply'
  | 'announcement';

export type NotificationScope = 'all' | 'general' | 'tickets';

export type AnnouncementTargetKind =
  | 'user'
  | 'company'
  | 'all_companies'
  | 'role'
  | 'all_users';

export interface AnnouncementTargets {
  kind: AnnouncementTargetKind;
  userIds?: number[];
  companyIds?: number[];
  role?: string;
}

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
  scope?: NotificationScope;
}

export interface CreateAnnouncementInput {
  title: string;
  body?: string | null;
  targets: AnnouncementTargets;
}

export interface AnnouncementListQuery {
  page?: number;
  limit?: number;
}

/** Máximo de destinatarios por anuncio (fan-out en memoria). */
export const MAX_ANNOUNCEMENT_RECIPIENTS = 5000;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  inventario: 'Inventario',
};

interface RecipientRow {
  companyId: number;
  userId: number | null;
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
    userId: number | undefined,
    query: ListNotificationsQuery = {},
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const visible = this.visibilityFilter(companyId, userId);
    const scoped: Prisma.NotificationWhereInput = {
      ...visible,
      ...this.scopeFilter(query.scope),
    };
    const where: Prisma.NotificationWhereInput = {
      ...scoped,
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
        where: { ...scoped, readAt: null },
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

  async markRead(id: number, companyId?: number, userId?: number) {
    const existing = await this.prisma.notification.findFirst({
      where: companyId
        ? { id, companyId, ...this.userVisibilityFilter(userId) }
        : { id: -1 },
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

  async markAllRead(companyId?: number, userId?: number) {
    if (!companyId) {
      return { count: 0 };
    }
    const result = await this.prisma.notification.updateMany({
      where: { companyId, readAt: null, ...this.userVisibilityFilter(userId) },
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

  /**
   * Crea un anuncio del superadmin expandiendo un fila de `Notification` por
   * destinatario (fan-out), para que cada destinatario tenga su propio
   * `readAt`. A diferencia de `notify()`, sí lanza: es una acción explícita.
   */
  async createAnnouncement(input: CreateAnnouncementInput) {
    const rows = await this.resolveAnnouncementRecipients(input.targets);
    if (rows.length === 0) {
      throw new BadRequestException(
        'La selección no incluye destinatarios válidos',
      );
    }
    if (rows.length > MAX_ANNOUNCEMENT_RECIPIENTS) {
      throw new BadRequestException(
        `El máximo de destinatarios por notificación es ` +
          `${MAX_ANNOUNCEMENT_RECIPIENTS} (seleccionaste ${rows.length})`,
      );
    }

    const dedupeKey = `announcement:${randomUUID()}`;
    const targetLabel = this.announcementLabel(input.targets);

    await this.prisma.notification.createMany({
      data: rows.map((row) => ({
        companyId: row.companyId,
        userId: row.userId,
        type: 'announcement',
        title: input.title,
        body: input.body ?? null,
        targetLabel,
        dedupeKey,
      })),
    });

    this.logger.info(
      `Announcement created: ${rows.length} recipients (${targetLabel})`,
    );
    return { dedupeKey, targetLabel, count: rows.length };
  }

  /** Listado agregado de anuncios enviados (una fila por envío). */
  async listAnnouncements(query: AnnouncementListQuery = {}) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const filter: Prisma.NotificationWhereInput = {
      type: 'announcement',
      dedupeKey: { not: null },
    };

    const [pageRows, allGroups] = await Promise.all([
      this.prisma.notification.findMany({
        where: filter,
        distinct: ['dedupeKey'],
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          dedupeKey: true,
          title: true,
          body: true,
          targetLabel: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.groupBy({
        by: ['dedupeKey'],
        where: filter,
      }),
    ]);

    const keys = pageRows
      .map((row) => row.dedupeKey)
      .filter((key): key is string => Boolean(key));

    const [recipientCounts, readCounts] = await Promise.all([
      this.prisma.notification.groupBy({
        by: ['dedupeKey'],
        where: { dedupeKey: { in: keys } },
        _count: { _all: true },
      }),
      this.prisma.notification.groupBy({
        by: ['dedupeKey'],
        where: { dedupeKey: { in: keys }, readAt: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const countBy = (
      groups: { dedupeKey: string | null; _count: { _all: number } }[],
    ) => new Map(groups.map((g) => [g.dedupeKey, g._count._all]));

    const recipients = countBy(recipientCounts);
    const reads = countBy(readCounts);

    const data = pageRows.map((row) => ({
      dedupeKey: row.dedupeKey,
      title: row.title,
      body: row.body,
      targetLabel: row.targetLabel,
      createdAt: row.createdAt,
      recipients: recipients.get(row.dedupeKey) ?? 0,
      readCount: reads.get(row.dedupeKey) ?? 0,
    }));

    const total = allGroups.length;
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /** Visibilidad general de lectura: tenant + destinatario concreto. */
  private visibilityFilter(
    companyId: number | undefined,
    userId: number | undefined,
  ): Prisma.NotificationWhereInput {
    if (!companyId) {
      return { id: -1 };
    }
    return { companyId, ...this.userVisibilityFilter(userId) };
  }

  /**
   * Una fila dirigida a un usuario concreto (`userId = n`) solo lo ve ese
   * usuario; las filas de empresa (`userId = null`) las ve cualquiera de la
   * empresa.
   */
  private userVisibilityFilter(
    userId: number | undefined,
  ): Prisma.NotificationWhereInput {
    if (!userId) {
      return {};
    }
    return { OR: [{ userId: null }, { userId }] };
  }

  private scopeFilter(
    scope: NotificationScope | undefined,
  ): Prisma.NotificationWhereInput {
    if (scope === 'tickets') {
      return { type: 'ticket_reply' };
    }
    if (scope === 'general') {
      return { type: { not: 'ticket_reply' } };
    }
    return {};
  }

  private async resolveAnnouncementRecipients(
    targets: AnnouncementTargets,
  ): Promise<RecipientRow[]> {
    switch (targets.kind) {
      case 'user': {
        if (!targets.userIds?.length) {
          throw new BadRequestException('Selecciona al menos un usuario');
        }
        const users = await this.prisma.user.findMany({
          where: {
            id: { in: targets.userIds },
            active: true,
            isDeleted: false,
            companyId: { not: null },
          },
          select: { id: true, companyId: true },
        });
        return users.map((u) => ({ companyId: u.companyId!, userId: u.id }));
      }
      case 'company': {
        if (!targets.companyIds?.length) {
          throw new BadRequestException('Selecciona al menos una empresa');
        }
        const companies = await this.prisma.company.findMany({
          where: { id: { in: targets.companyIds }, active: true },
          select: { id: true },
        });
        return companies.map((c) => ({ companyId: c.id, userId: null }));
      }
      case 'all_companies': {
        const companies = await this.prisma.company.findMany({
          where: { active: true },
          select: { id: true },
        });
        return companies.map((c) => ({ companyId: c.id, userId: null }));
      }
      case 'role': {
        if (!targets.role) {
          throw new BadRequestException('Selecciona un rol');
        }
        const users = await this.prisma.user.findMany({
          where: {
            role: targets.role,
            active: true,
            isDeleted: false,
            companyId: { not: null },
          },
          select: { id: true, companyId: true },
        });
        return users.map((u) => ({ companyId: u.companyId!, userId: u.id }));
      }
      case 'all_users': {
        const users = await this.prisma.user.findMany({
          where: {
            active: true,
            isDeleted: false,
            companyId: { not: null },
          },
          select: { id: true, companyId: true },
        });
        return users.map((u) => ({ companyId: u.companyId!, userId: u.id }));
      }
      default:
        throw new BadRequestException('Alcance de notificación no válido');
    }
  }

  private announcementLabel(targets: AnnouncementTargets): string {
    switch (targets.kind) {
      case 'user':
        return 'Usuarios seleccionados';
      case 'company':
        return 'Empresas seleccionadas';
      case 'all_companies':
        return 'Todas las empresas';
      case 'role':
        return `Rol: ${ROLE_LABELS[targets.role ?? ''] ?? targets.role}`;
      case 'all_users':
        return 'Todos los usuarios';
      default:
        return 'Anuncio';
    }
  }
}
