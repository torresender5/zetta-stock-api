import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class SaleService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  async findAll(companyId?: number) {
    this.logger.info('Starting SaleService findAll');
    return this.prisma.sale.findMany({
      where: companyId ? { companyId } : {},
      include: {
        items: true,
        client: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number, companyId?: number) {
    this.logger.info(`Finding sale by ID: ${id}`);
    try {
      const result = await this.prisma.sale.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
        include: {
          items: true,
          client: true,
          invoice: true,
        },
      });
      return result || null;
    } catch (error) {
      this.logger.error(`Error finding sale ${id}:`, error);
      throw error;
    }
  }

  async create(data: any, companyId?: number) {
    try {
      this.logger.info('Creating sale:', { clientId: data.clientId });

      // Get client info for invoice (must belong to same company)
      const client = await this.prisma.client.findFirst({
        where: {
          id: Number(data.clientId),
          ...(companyId ? { companyId } : {}),
        },
      });

      if (!client) {
        throw new Error('Client not found');
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

      // Generate invoice number
      const year = new Date().getFullYear();
      const seq = Math.floor(Math.random() * 9000) + 1000;
      const invoiceNumber = `FAC-${year}-${seq}`;

      // Create sale with items and invoice in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create the sale
        const sale = await tx.sale.create({
          data: {
            companyId,
            clientId: Number(data.clientId),
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
            client: true,
          },
        });

        // Create the invoice
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            saleId: sale.id,
            companyId,
            clientId: Number(data.clientId),
            clientName: client.name,
            clientDocument: client.document,
            clientAddress: client.address,
            date: new Date(data.date),
            subtotal,
            tax,
            total,
            status: data.paymentStatus,
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
                decrement: Number(item.quantity),
              },
            },
          });
        }

        return { sale, invoice };
      });

      return result;
    } catch (error) {
      this.logger.error('Error creating sale:', error);
      throw error;
    }
  }

  async updatePaymentStatus(
    id: number,
    paymentStatus: string,
    companyId?: number,
  ) {
    try {
      this.logger.info(`Updating sale payment status: ${id}`);
      const existing = await this.prisma.sale.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      if (!existing) {
        throw new Error('Venta no encontrada');
      }
      const sale = await this.prisma.sale.update({
        where: { id },
        data: { paymentStatus },
        include: {
          items: true,
          client: true,
        },
      });

      // Also update the invoice status
      await this.prisma.invoice.updateMany({
        where: { saleId: id, ...(companyId ? { companyId } : {}) },
        data: { status: paymentStatus },
      });

      return sale;
    } catch (error) {
      this.logger.error(`Error updating sale ${id}:`, error);
      throw error;
    }
  }

  async findAllInvoices(companyId?: number) {
    this.logger.info('Starting SaleService findAllInvoices');
    return this.prisma.invoice.findMany({
      where: companyId ? { companyId } : {},
      include: {
        sale: {
          include: {
            items: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateInvoiceStatus(id: number, status: string, companyId?: number) {
    try {
      this.logger.info(`Updating invoice status: ${id}`);
      const existing = await this.prisma.invoice.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      if (!existing) {
        throw new Error('Factura no encontrada');
      }
      const invoice = await this.prisma.invoice.update({
        where: { id },
        data: { status },
      });

      // Also update the sale payment status
      await this.prisma.sale.updateMany({
        where: { id: invoice.saleId, ...(companyId ? { companyId } : {}) },
        data: { paymentStatus: status },
      });

      return invoice;
    } catch (error) {
      this.logger.error(`Error updating invoice ${id}:`, error);
      throw error;
    }
  }
}
