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

  async findAll() {
    this.logger.info('Starting SaleService findAll');
    return this.prisma.sale.findMany({
      include: {
        items: true,
        client: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number) {
    this.logger.info(`Finding sale by ID: ${id}`);
    try {
      const result = await this.prisma.sale.findUnique({
        where: { id },
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

  async create(data: any) {
    try {
      this.logger.info('Creating sale:', { clientId: data.clientId });

      // Get client info for invoice
      const client = await this.prisma.client.findUnique({
        where: { id: Number(data.clientId) },
      });

      if (!client) {
        throw new Error('Client not found');
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

  async updatePaymentStatus(id: number, paymentStatus: string) {
    try {
      this.logger.info(`Updating sale payment status: ${id}`);
      const sale = await this.prisma.sale.update({
        where: { id },
        data: { paymentStatus },
        include: {
          items: true,
          client: true,
        },
      });

      // Also update the invoice status
      await this.prisma.invoice.update({
        where: { saleId: id },
        data: { status: paymentStatus },
      });

      return sale;
    } catch (error) {
      this.logger.error(`Error updating sale ${id}:`, error);
      throw error;
    }
  }

  async findAllInvoices() {
    this.logger.info('Starting SaleService findAllInvoices');
    return this.prisma.invoice.findMany({
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

  async updateInvoiceStatus(id: number, status: string) {
    try {
      this.logger.info(`Updating invoice status: ${id}`);
      const invoice = await this.prisma.invoice.update({
        where: { id },
        data: { status },
      });

      // Also update the sale payment status
      await this.prisma.sale.update({
        where: { id: invoice.saleId },
        data: { paymentStatus: status },
      });

      return invoice;
    } catch (error) {
      this.logger.error(`Error updating invoice ${id}:`, error);
      throw error;
    }
  }
}
