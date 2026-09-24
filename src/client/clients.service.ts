import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ClientQueryDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  async findAllDropdown(companyId?: number) {
    this.logger.info('Starting ClientsService findAllDropdown');
    return this.prisma.client.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(query: ClientQueryDto, companyId?: number) {
    this.logger.info('Starting ClientsService findAll');

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { document: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    try {
      const [data, total] = await Promise.all([
        this.prisma.client.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.client.count({ where }),
      ]);
      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    } catch (error) {
      this.logger.error('Error finding clients:', error);
      throw error;
    }
  }

  async findById(id: number, companyId?: number) {
    this.logger.info(`Finding client by ID: ${id}`);
    try {
      const result = await this.prisma.client.findFirst({
        where: {
          id,
          ...(companyId ? { companyId } : {}),
        },
      });
      return result || null;
    } catch (error) {
      this.logger.error(`Error finding client ${id}:`, error);
      throw error;
    }
  }

  async findByEmail(email: string, companyId?: number) {
    this.logger.info(`Finding client by email: ${email}`);
    try {
      const result = await this.prisma.client.findFirst({
        where: {
          email,
          ...(companyId ? { companyId } : {}),
        },
      });
      return result || null;
    } catch (error) {
      this.logger.error(`Error finding client ${email}:`, error);
      throw error;
    }
  }

  async create(data: any, companyId?: number) {
    try {
      this.logger.info('Creating client:', { name: data.name });
      const createData = {
        ...data,
        companyId,
      };
      return await this.prisma.client.create({
        data: createData,
      });
    } catch (error) {
      this.logger.error('Error creating client:', error);
      throw error;
    }
  }

  async update(id: number, data: any, companyId?: number) {
    try {
      this.logger.info(`Updating client: ${id}`);
      const existing = await this.prisma.client.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      if (!existing) {
        throw new Error('Cliente no encontrado');
      }
      return await this.prisma.client.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.logger.error(`Error updating client ${id}:`, error);
      throw error;
    }
  }

  async delete(id: number, companyId?: number) {
    try {
      this.logger.info(`Deleting client: ${id}`);
      const existing = await this.prisma.client.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      if (!existing) {
        throw new Error('Cliente no encontrado');
      }
      return await this.prisma.client.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Error deleting client ${id}:`, error);
      throw error;
    }
  }
}
