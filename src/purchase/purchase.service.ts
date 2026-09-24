import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PurchaseQueryDto } from './dto/purchase.dto';

@Injectable()
export class PurchaseService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  async findAll(query: PurchaseQueryDto, companyId?: number) {
    this.logger.info('Starting PurchaseService findAll');

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (query.supplierId) {
      where.supplierId = Number(query.supplierId);
    }
    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus;
    }
    if (query.search) {
      where.OR = [
        { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
        {
          items: {
            some: {
              productName: { contains: query.search, mode: 'insensitive' },
            },
          },
        },
      ];
    }
    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    try {
      const [data, total] = await Promise.all([
        this.prisma.purchase.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            items: true,
            supplier: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.purchase.count({ where }),
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
      this.logger.error('Error finding purchases:', error);
      throw error;
    }
  }

  async findById(id: number, companyId?: number) {
    this.logger.info(`Finding purchase by ID: ${id}`);
    try {
      const result = await this.prisma.purchase.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
        include: {
          items: true,
          supplier: true,
        },
      });
      return result || null;
    } catch (error) {
      this.logger.error(`Error finding purchase ${id}:`, error);
      throw error;
    }
  }

  async create(data: any, companyId?: number) {
    try {
      this.logger.info('Creating purchase:', { supplierId: data.supplierId });

      // Supplier must belong to the same company
      const supplier = await this.prisma.supplier.findFirst({
        where: {
          id: Number(data.supplierId),
          ...(companyId ? { companyId } : {}),
        },
      });
      if (!supplier) {
        throw new NotFoundException('Proveedor no encontrado');
      }

      // Verify all products belong to the same company
      for (const item of data.items) {
        const product = await this.prisma.product.findFirst({
          where: {
            id: Number(item.productId),
            ...(companyId ? { companyId } : {}),
          },
        });
        if (!product) {
          throw new NotFoundException(
            `Producto ${item.productId} no encontrado`,
          );
        }
      }

      // Calculate totals
      const subtotal = data.items.reduce(
        (sum: number, item: any) => sum + Number(item.subtotal),
        0,
      );
      const tax = Math.round(subtotal * 0.19);
      const total = subtotal + tax;

      // Generate sequential purchase number per company and year, retrying on
      // unique constraint collisions caused by concurrent creations
      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const year = new Date().getFullYear();
        const seq =
          (await this.prisma.purchase.count({
            where: {
              ...(companyId ? { companyId } : {}),
              date: { gte: new Date(`${year}-01-01`) },
            },
          })) + 1;
        const purchaseNumber = `COMP-${year}-${String(seq).padStart(4, '0')}`;
        try {
          return await this.createWithPurchaseNumber(
            data,
            companyId,
            subtotal,
            tax,
            total,
            purchaseNumber,
          );
        } catch (error: any) {
          if (error?.code !== 'P2002' || attempt === maxAttempts - 1) {
            throw error;
          }
          this.logger.warn('Colisión de código de compra, reintentando...', {
            purchaseNumber,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error creating purchase:', error);
      throw error;
    }
  }

  private async createWithPurchaseNumber(
    data: any,
    companyId: number | undefined,
    subtotal: number,
    tax: number,
    total: number,
    purchaseNumber: string,
  ) {
    // Create purchase with items in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the purchase
      const purchase = await tx.purchase.create({
        data: {
          companyId,
          purchaseNumber,
          supplierId: Number(data.supplierId),
          date: new Date(data.date),
          subtotal,
          tax,
          total,
          paymentStatus: data.paymentStatus,
          items: {
            create: data.items.map((item: any) => ({
              productId: Number(item.productId),
              productName: item.productName,
              size: item.size || null,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              subtotal: Number(item.subtotal),
            })),
          },
        },
        include: {
          items: true,
          supplier: true,
        },
      });

      // Update product stock and purchase price
      for (const item of data.items) {
        const product = await tx.product.findFirst({
          where: {
            id: Number(item.productId),
            ...(companyId ? { companyId } : {}),
          },
        });
        if (!product) {
          throw new NotFoundException(
            `Producto ${item.productId} no encontrado`,
          );
        }

        const sizeStock = (product.sizes as any[]) ?? [];
        let updateStock: number;
        let updateSizes: any;
        const updatePurchasePrice = Number(item.unitPrice);

        if (Array.isArray(sizeStock) && sizeStock.length > 0) {
          // Product with sizes: require a size per line
          if (!item.size) {
            throw new BadRequestException(
              `El producto "${product.name}" requiere seleccionar una talla`,
            );
          }
          const sizeIndex = sizeStock.findIndex((s) => s.size === item.size);
          if (sizeIndex === -1) {
            throw new BadRequestException(
              `Talla "${item.size}" no válida para "${product.name}"`,
            );
          }
          updateSizes = sizeStock.map((s, i) =>
            i === sizeIndex
              ? {
                  ...s,
                  stock: (Number(s.stock) ?? 0) + Number(item.quantity),
                }
              : s,
          );
          updateStock = updateSizes.reduce(
            (sum: number, s: any) => sum + (Number(s.stock) ?? 0),
            0,
          );
        } else {
          updateStock = product.stock + Number(item.quantity);
          updateSizes = undefined;
        }

        await tx.product.update({
          where: { id: Number(item.productId) },
          data: {
            stock: updateStock,
            ...(updateSizes !== undefined ? { sizes: updateSizes } : {}),
            purchasePrice: updatePurchasePrice,
          },
        });
      }

      return purchase;
    });

    return result;
  }

  async updatePaymentStatus(
    id: number,
    paymentStatus: string,
    companyId?: number,
  ) {
    try {
      this.logger.info(`Updating purchase payment status: ${id}`);
      const existing = await this.prisma.purchase.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      if (!existing) {
        throw new NotFoundException('Compra no encontrada');
      }
      return await this.prisma.purchase.update({
        where: { id },
        data: { paymentStatus },
        include: {
          items: true,
          supplier: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error updating purchase ${id}:`, error);
      throw error;
    }
  }
}
