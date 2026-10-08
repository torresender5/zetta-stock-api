import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { R2Service } from 'src/r2/r2.service';
import { AuthUserPayload } from 'src/auth/auth-user.interface';
import {
  AdminTicketQueryDto,
  COMPANY_TICKET_STATUSES,
  SUPPORT_TICKET_STATUSES,
  TicketCreateDto,
  TicketQueryDto,
} from './dto/ticket.dto';

const COMPANY_INCLUDE: Prisma.TicketInclude = {
  messages: { orderBy: { createdAt: 'asc' } },
  _count: { select: { messages: true } },
};

const ADMIN_INCLUDE: Prisma.TicketInclude = {
  ...COMPANY_INCLUDE,
  company: { select: { id: true, name: true, kind: true } },
};

const LIST_INCLUDE: Prisma.TicketInclude = {
  _count: { select: { messages: true } },
  messages: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { createdAt: true, body: true },
  },
};

const ADMIN_LIST_INCLUDE: Prisma.TicketInclude = {
  ...LIST_INCLUDE,
  company: { select: { id: true, name: true, kind: true } },
};

@Injectable()
export class TicketService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
    private notifications: NotificationService,
    private r2: R2Service,
  ) {}

  // ── Lado empresa (JWT + rol admin) ─────────────────────────────────────

  async findAll(query: TicketQueryDto, companyId: number) {
    this.logger.info('Starting TicketService findAll');
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.TicketWhereInput = { companyId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { subject: { contains: query.search, mode: 'insensitive' } },
        {
          messages: {
            some: { body: { contains: query.search, mode: 'insensitive' } },
          },
        },
      ];
    }

    try {
      const [data, total] = await Promise.all([
        this.prisma.ticket.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: LIST_INCLUDE,
        }),
        this.prisma.ticket.count({ where }),
      ]);
      return {
        data: data.map(({ messages, ...rest }) => ({
          ...rest,
          lastMessageAt: messages[0]?.createdAt ?? null,
          lastMessagePreview: messages[0]?.body ?? null,
        })),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    } catch (error) {
      this.logger.error('Error finding tickets:', error);
      throw error;
    }
  }

  async create(
    data: TicketCreateDto,
    user: AuthUserPayload,
    file?: Express.Multer.File,
  ) {
    this.logger.info('Starting TicketService create');
    let image: string | null = null;
    if (file) {
      image = await this.r2.uploadFile('tickets', file);
    }
    try {
      return await this.prisma.ticket.create({
        data: {
          companyId: user.companyId!,
          subject: data.subject,
          category: data.category,
          image,
          messages: {
            create: {
              authorKind: 'empresa',
              authorId: user.sub,
              authorName: user.name,
              body: data.body,
            },
          },
        },
        include: COMPANY_INCLUDE,
      });
    } catch (error) {
      if (image) {
        await this.r2.deleteFile(image);
      }
      this.logger.error('Error creating ticket:', error);
      throw error;
    }
  }

  async getDetail(id: number, companyId: number) {
    this.logger.info(`Finding ticket by ID: ${id}`);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, companyId },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }
    // Abrir el ticket marca el hilo como leído para la empresa (badge).
    return this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { companyReadAt: new Date() },
      include: COMPANY_INCLUDE,
    });
  }

  async addCompanyMessage(id: number, body: string, user: AuthUserPayload) {
    this.logger.info(`Adding company message to ticket: ${id}`);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, status: true },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }
    // Reabrir si la empresa responde tras el cierre; si el soporte estaba
    // esperando su respuesta, devolverlo a 'en proceso'.
    let nextStatus = ticket.status;
    if (ticket.status === 'finalizado') {
      nextStatus = 'abierto';
    } else if (ticket.status === 'pendiente') {
      nextStatus = 'en_proceso';
    }
    return this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
        companyReadAt: new Date(),
        messages: {
          create: {
            authorKind: 'empresa',
            authorId: user.sub,
            authorName: user.name,
            body,
          },
        },
      },
      include: COMPANY_INCLUDE,
    });
  }

  async updateCompanyStatus(id: number, status: string, companyId: number) {
    this.logger.info(`Updating company ticket status: ${id} -> ${status}`);
    if (!COMPANY_TICKET_STATUSES.includes(status as never)) {
      throw new ForbiddenException('Estado no válido para la empresa');
    }
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }
    return this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { status },
      include: COMPANY_INCLUDE,
    });
  }

  // ── Lado superadmin (UserAdmin por Basic) ──────────────────────────────

  async adminFindAll(query: AdminTicketQueryDto) {
    this.logger.info('Starting TicketService adminFindAll');
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.TicketWhereInput = {};
    if (query.companyId) {
      where.companyId = query.companyId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { company: { name: { contains: query.search, mode: 'insensitive' } } },
        {
          messages: {
            some: { body: { contains: query.search, mode: 'insensitive' } },
          },
        },
      ];
    }

    try {
      const [data, total] = await Promise.all([
        this.prisma.ticket.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: ADMIN_LIST_INCLUDE,
        }),
        this.prisma.ticket.count({ where }),
      ]);
      return {
        data: data.map(({ messages, ...rest }) => ({
          ...rest,
          lastMessageAt: messages[0]?.createdAt ?? null,
          lastMessagePreview: messages[0]?.body ?? null,
        })),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    } catch (error) {
      this.logger.error('Error finding admin tickets:', error);
      throw error;
    }
  }

  async adminGetDetail(id: number) {
    this.logger.info(`Finding admin ticket by ID: ${id}`);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id },
      include: ADMIN_INCLUDE,
    });
    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }
    return ticket;
  }

  async adminAddMessage(id: number, body: string, user: AuthUserPayload) {
    this.logger.info(`Adding support message to ticket: ${id}`);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id },
      select: { id: true, status: true, companyId: true, subject: true },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }
    // La primera respuesta del soporte toma el ticket ('en proceso').
    const nextStatus =
      ticket.status === 'abierto' ? 'en_proceso' : ticket.status;
    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
        messages: {
          create: {
            authorKind: 'soporte',
            authorId: user.sub,
            authorName: user.name,
            body,
          },
        },
      },
      include: ADMIN_INCLUDE,
    });
    // Nunca lanza: el aviso no debe impedir responder.
    await this.notifications.notify({
      companyId: ticket.companyId,
      type: 'ticket_reply',
      title: `Soporte respondió tu ticket "${ticket.subject}"`,
      body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
      dedupeKey: `ticket_reply:${ticket.id}`,
    });
    return updated;
  }

  async adminUpdateStatus(id: number, status: string) {
    this.logger.info(`Updating admin ticket status: ${id} -> ${status}`);
    if (!SUPPORT_TICKET_STATUSES.includes(status as never)) {
      throw new ForbiddenException('Estado no válido para el soporte');
    }
    const ticket = await this.prisma.ticket.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }
    return this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { status },
      include: ADMIN_INCLUDE,
    });
  }
}
