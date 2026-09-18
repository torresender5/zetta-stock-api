import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class PurchaseService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  async findAll(companyId?: number) {
    this.logger.info('Starting PurchaseService findAll');
    return this.prisma.purchase.findMany({
      where: companyId ? { companyId } : {},
      include: {
        items: true,
        supplier: true,
      },
      orderBy: { createdAt: 'desc' },
    });
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
        throw new Error('Supplier not found');
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
          throw new Error(`Product ${item.productId} not found`);
        }
      }

      // Calculate totals
      const subtotal = data.items.reduce(
        (sum: number, item: any) => sum + item.subtotal,
        0,
      );
      const tax = Math.round(subtotal * 0.19);
      const total = subtotal + tax;

      // Create purchase with items in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create the purchase
        const purchase = await tx.purchase.create({
          data: {
            companyId,
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

        // Update product stock
        for (const item of data.items) {
          const product = await tx.product.findFirst({
            where: {
              id: Number(item.productId),
              ...(companyId ? { companyId } : {}),
            },
          });
          if (!product) {
            throw new Error(`Product ${item.productId} not found`);
          }
          await tx.product.update({
            where: { id: Number(item.productId) },
            data: {
              stock: {
                increment: Number(item.quantity),
              },
            },
          });
        }

        return purchase;
      });

      return result;
    } catch (error) {
      this.logger.error('Error creating purchase:', error);
      throw error;
    }
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
        throw new Error('Compra no encontrada');
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
