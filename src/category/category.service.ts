import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { CategoryQueryDto } from './dto/category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  async findAllDropdown(companyId?: number) {
    this.logger.info('Starting CategoryService findAllDropdown');
    return this.prisma.category.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { name: 'asc' },
    });
  }

  async findAll(query: CategoryQueryDto, companyId?: number) {
    this.logger.info('Starting CategoryService findAll');

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.CategoryWhereInput = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
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
        this.prisma.category.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: 'asc' },
        }),
        this.prisma.category.count({ where }),
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
      this.logger.error('Error finding categories:', error);
      throw error;
    }
  }

  async findById(id: number, companyId?: number) {
    this.logger.info(`Finding category by ID: ${id}`);
    try {
      const result = await this.prisma.category.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      return result || null;
    } catch (error) {
      this.logger.error(`Error finding category ${id}:`, error);
      throw error;
    }
  }

  private async assertNameAvailable(
    name: string,
    companyId?: number,
    excludeId?: number,
  ) {
    const existing = await this.prisma.category.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(companyId ? { companyId } : {}),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Ya existe una categoría llamada "${existing.name}"`,
      );
    }
  }

  private async generateCode(companyId?: number): Promise<string> {
    const year = new Date().getFullYear();
    const seq =
      (await this.prisma.category.count({
        where: { ...(companyId ? { companyId } : {}) },
      })) + 1;
    return `CAT-${year}-${String(seq).padStart(4, '0')}`;
  }

  async create(
    data: { name: string; code?: string; description?: string },
    companyId?: number,
  ) {
    try {
      this.logger.info('Creating category:', { name: data.name });
      const name = data.name.trim();
      if (!name) {
        throw new BadRequestException('El nombre de la categoría es requerido');
      }
      await this.assertNameAvailable(name, companyId);

      return await this.prisma.category.create({
        data: {
          companyId,
          name,
          code: data.code?.trim() || (await this.generateCode(companyId)),
          description: data.description?.trim() || null,
        },
      });
    } catch (error) {
      this.logger.error('Error creating category:', error);
      throw error;
    }
  }

  async update(
    id: number,
    data: { name?: string; code?: string; description?: string },
    companyId?: number,
  ) {
    try {
      this.logger.info(`Updating category: ${id}`);
      const existing = await this.prisma.category.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      if (!existing) {
        throw new NotFoundException('Categoría no encontrada');
      }

      const updateData: {
        name?: string;
        code?: string;
        description?: string | null;
      } = {};
      if (data.name !== undefined) {
        const name = data.name.trim();
        if (!name) {
          throw new BadRequestException(
            'El nombre de la categoría es requerido',
          );
        }
        await this.assertNameAvailable(name, companyId, id);
        updateData.name = name;
      }
      if (data.code !== undefined) {
        updateData.code = data.code.trim();
      }
      if (data.description !== undefined) {
        updateData.description = data.description?.trim() || null;
      }

      const updated = await this.prisma.category.update({
        where: { id },
        data: updateData,
      });

      // Mantiene sincronizado el nombre denormalizado en los productos
      if (updateData.name !== undefined && updateData.name !== existing.name) {
        await this.prisma.product.updateMany({
          where: {
            categoryId: id,
            category: existing.name,
            ...(companyId ? { companyId } : {}),
          },
          data: { category: updateData.name },
        });
      }

      return updated;
    } catch (error) {
      this.logger.error(`Error updating category ${id}:`, error);
      throw error;
    }
  }

  async remove(id: number, companyId?: number) {
    try {
      this.logger.info(`Deleting category: ${id}`);
      const existing = await this.prisma.category.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      if (!existing) {
        throw new NotFoundException('Categoría no encontrada');
      }

      const productsUsing = await this.prisma.product.count({
        where: { categoryId: id },
      });
      if (productsUsing > 0) {
        throw new BadRequestException(
          `No se puede eliminar: ${productsUsing} producto(s) usan esta categoría`,
        );
      }

      return await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      this.logger.error(`Error deleting category ${id}:`, error);
      throw error;
    }
  }
}
