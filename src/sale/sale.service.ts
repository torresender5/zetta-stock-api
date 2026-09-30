import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ListSalesQueryDto } from './dto/sale.dto';
import { round2 } from 'src/common/round';

const WALK_IN_CLIENT_NAME = 'Consumidor final';
const WALK_IN_CLIENT_EMAIL = 'consumidor-final@zettastock.local';
const WALK_IN_CLIENT_DOCUMENT = 'CF-0000000';

@Injectable()
export class SaleService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  async findAll(companyId?: number, query?: ListSalesQueryDto) {
    this.logger.info('Starting SaleService findAll');
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (query?.paymentStatus) {
      where.paymentStatus = query.paymentStatus;
    }
    if (query?.search) {
      where.OR = [
        { client: { name: { contains: query.search, mode: 'insensitive' } } },
        {
          items: {
            some: {
              productName: { contains: query.search, mode: 'insensitive' },
            },
          },
        },
      ];
    }
    if (query?.startDate || query?.endDate) {
      where.date = {};
      if (query?.startDate) {
        where.date.gte = new Date(query.startDate);
      }
      if (query?.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    try {
      const [data, total] = await Promise.all([
        this.prisma.sale.findMany({
          where,
          include: {
            items: true,
            client: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.sale.count({ where }),
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
      this.logger.error('Error finding sales:', error);
      throw error;
    }
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

  async create(data: any, companyId?: number, userId?: number) {
    try {
      this.logger.info('Creating sale:', { clientId: data.clientId });

      // Requiere una caja abierta del usuario para registrar la venta
      const register = await this.findActiveRegister(companyId, userId);
      if (!register) {
        throw new BadRequestException(
          'No hay una caja abierta para realizar la venta',
        );
      }

      // Get client info for invoice (must belong to same company).
      // Si no se envía clientId se usa el cliente genérico "Consumidor final"
      const client = await this.resolveClient(companyId, data.clientId);

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

      // Generate sequential sale number per company and year, retrying on
      // unique constraint collisions caused by concurrent creations
      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const year = new Date().getFullYear();
        const seq =
          (await this.prisma.sale.count({
            where: {
              ...(companyId ? { companyId } : {}),
              date: { gte: new Date(`${year}-01-01`) },
            },
          })) + 1;
        const saleNumber = `VEN-${year}-${String(seq).padStart(4, '0')}`;
        try {
          return await this.createWithSaleNumber(
            data,
            companyId,
            client,
            subtotal,
            tax,
            total,
            saleNumber,
            register,
          );
        } catch (error: any) {
          if (error?.code !== 'P2002' || attempt === maxAttempts - 1) {
            throw error;
          }
          this.logger.warn('Colisión de código de venta, reintentando...', {
            saleNumber,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error creating sale:', error);
      throw error;
    }
  }

  private async resolveClient(companyId?: number, clientId?: unknown) {
    const id = Number(clientId);
    if (
      clientId !== undefined &&
      clientId !== null &&
      clientId !== '' &&
      id > 0
    ) {
      const client = await this.prisma.client.findFirst({
        where: {
          id,
          ...(companyId ? { companyId } : {}),
        },
      });

      if (!client) {
        throw new Error('Client not found');
      }

      return client;
    }

    return this.getOrCreateWalkInClient(companyId);
  }

  private async getOrCreateWalkInClient(companyId?: number) {
    const where = {
      name: WALK_IN_CLIENT_NAME,
      ...(companyId ? { companyId } : {}),
    };
    const existing = await this.prisma.client.findFirst({ where });
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.client.create({
        data: {
          companyId,
          name: WALK_IN_CLIENT_NAME,
          email: WALK_IN_CLIENT_EMAIL,
          phone: '',
          address: '',
          document: WALK_IN_CLIENT_DOCUMENT,
        },
      });
    } catch (error: any) {
      // Colisión por concurrencia (unique companyId+email / companyId+document)
      if (error?.code === 'P2002') {
        const client = await this.prisma.client.findFirst({ where });
        if (client) {
          return client;
        }
      }
      throw error;
    }
  }

  private async findActiveRegister(companyId?: number, userId?: number) {
    if (!companyId) {
      return null;
    }
    return this.prisma.cashRegister.findFirst({
      where: {
        status: 'open',
        ...(companyId ? { companyId } : {}),
        ...(userId ? { userId } : {}),
      },
    });
  }

  private mapRefundMethod(method?: string): string {
    if (!method) {
      return 'cash';
    }
    const normalized = method.toLowerCase();
    if (normalized.includes('tarjeta') || normalized.includes('card')) {
      return 'card';
    }
    if (normalized.includes('transfe')) {
      return 'transfer';
    }
    if (normalized.includes('credit') || normalized.includes('crédit')) {
      return 'credit';
    }
    return 'cash';
  }

  private async createWithSaleNumber(
    data: any,
    companyId: number | undefined,
    client: any,
    subtotal: number,
    tax: number,
    total: number,
    saleNumber: string,
    register?: any,
  ) {
    const changeAmount =
      data.receivedAmount != null && Number(data.receivedAmount) > total
        ? Number(data.receivedAmount) - total
        : null;

    const fxRate = Number(data.fxRate) > 0 ? Number(data.fxRate) : undefined;
    const inVES = (usd: number | null | undefined): number | null =>
      usd != null && fxRate ? round2(Number(usd) * fxRate) : null;

    // Create sale with items and invoice in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the sale
      const sale = await tx.sale.create({
        data: {
          companyId,
          saleNumber,
          clientId: client.id,
          date: new Date(data.date),
          subtotal,
          tax,
          total,
          paymentStatus: data.paymentStatus,
          paymentMethod: data.paymentMethod || 'cash',
          receivedAmount:
            data.receivedAmount != null ? Number(data.receivedAmount) : null,
          changeAmount,
          fxRate: fxRate ?? null,
          subtotalVes: inVES(subtotal),
          taxVes: inVES(tax),
          totalVes: inVES(total),
          receivedAmountVes:
            data.receivedAmount != null
              ? inVES(Number(data.receivedAmount))
              : null,
          changeAmountVes: changeAmount != null ? inVES(changeAmount) : null,
          items: {
            create: data.items.map((item: any) => ({
              productId: Number(item.productId),
              productName: item.productName,
              size: item.size || null,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              subtotal: Number(item.subtotal),
              unitPriceVes: inVES(Number(item.unitPrice)),
              subtotalVes: inVES(Number(item.subtotal)),
            })),
          },
        },
        include: {
          items: true,
          client: true,
        },
      });

      // Create the invoice
      const year = new Date().getFullYear();
      const invoiceSeq = Math.floor(Math.random() * 9000) + 1000;
      const invoiceNumber = `FAC-${year}-${invoiceSeq}`;
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          saleId: sale.id,
          companyId,
          clientId: client.id,
          clientName: client.name,
          clientDocument: client.document,
          clientAddress: client.address,
          date: new Date(data.date),
          subtotal,
          tax,
          total,
          fxRate: fxRate ?? null,
          subtotalVes: inVES(subtotal),
          taxVes: inVES(tax),
          totalVes: inVES(total),
          status: data.paymentStatus,
        },
      });

      // Update product stock (handle sizes like purchases)
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

        const sizeStock = (product.sizes as any[]) ?? [];
        let updateStock: number;
        let updateSizes: any;

        if (Array.isArray(sizeStock) && sizeStock.length > 0) {
          // Product with sizes: require a size per line
          if (!item.size) {
            throw new Error(
              `El producto "${product.name}" requiere seleccionar una talla`,
            );
          }
          const sizeIndex = sizeStock.findIndex((s) => s.size === item.size);
          if (sizeIndex === -1) {
            throw new Error(
              `Talla "${item.size}" no válida para "${product.name}"`,
            );
          }
          updateSizes = sizeStock.map((s, i) =>
            i === sizeIndex
              ? {
                  ...s,
                  stock: Math.max(
                    0,
                    (Number(s.stock) ?? 0) - Number(item.quantity),
                  ),
                }
              : s,
          );
          updateStock = updateSizes.reduce(
            (sum: number, s: any) => sum + (Number(s.stock) ?? 0),
            0,
          );
        } else {
          updateStock = Number(product.stock) - Number(item.quantity);
          updateSizes = undefined;
        }

        await tx.product.update({
          where: { id: Number(item.productId) },
          data: {
            stock: Math.max(0, updateStock),
            ...(updateSizes !== undefined ? { sizes: updateSizes } : {}),
          },
        });
      }

      // Register the cash movement for paid sales
      if (data.paymentStatus === 'paid' && register) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: register.id,
            companyId,
            saleId: sale.id,
            type: 'sale',
            paymentMethod: data.paymentMethod || 'cash',
            amount: total,
            amountVes: inVES(total),
            fxRate: fxRate ?? null,
            description: `Venta ${saleNumber}`,
          },
        });
      }

      return { sale, invoice };
    });

    return result;
  }

  async updatePaymentStatus(
    id: number,
    paymentStatus: string,
    companyId?: number,
    cancelledReason?: string,
    refundAmount?: number,
    refundMethod?: string,
    newPaymentMethod?: string,
    userId?: number,
  ) {
    try {
      this.logger.info(`Updating sale payment status: ${id}`);
      const existing = await this.prisma.sale.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
        include: { items: true },
      });
      if (!existing) {
        throw new Error('Venta no encontrada');
      }

      const from = existing.paymentStatus;
      const to = paymentStatus;

      // Transiciones que mueven dinero en la caja
      const touchesCash =
        (to === 'paid' && from !== 'paid') ||
        (to === 'pending' && from === 'paid') ||
        (to === 'cancelled' && from === 'paid');

      const register = touchesCash
        ? await this.findActiveRegister(companyId, userId)
        : null;
      if (touchesCash && !register) {
        throw new BadRequestException(
          'No hay una caja abierta para registrar el movimiento',
        );
      }

      const result = await this.prisma.$transaction(async (tx) => {
        // Restore stock when cancelling
        if (paymentStatus === 'cancelled') {
          for (const item of existing.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  increment: Number(item.quantity),
                },
              },
            });
          }
        }

        const sale = await tx.sale.update({
          where: { id },
          data: {
            paymentStatus,
            cancelledReason:
              paymentStatus === 'cancelled' ? cancelledReason || null : null,
            refundAmount:
              paymentStatus === 'cancelled' ? (refundAmount ?? null) : null,
            refundAmountVes:
              paymentStatus === 'cancelled' &&
              refundAmount != null &&
              existing.fxRate
                ? round2(refundAmount * existing.fxRate)
                : null,
            refundMethod:
              paymentStatus === 'cancelled' ? refundMethod || null : null,
            ...(paymentStatus === 'paid' && newPaymentMethod
              ? { paymentMethod: newPaymentMethod }
              : {}),
          },
          include: {
            items: true,
            client: true,
          },
        });

        // Also update the invoice status
        await tx.invoice.updateMany({
          where: { saleId: id, ...(companyId ? { companyId } : {}) },
          data: {
            status: paymentStatus,
            ...(paymentStatus === 'cancelled'
              ? { cancelledReason: cancelledReason || null }
              : { cancelledReason: null }),
          },
        });

        // Register the cash movement for money transitions
        if (register) {
          if (to === 'paid' && from !== 'paid') {
            await tx.cashMovement.create({
              data: {
                cashRegisterId: register.id,
                companyId,
                saleId: id,
                type: 'sale',
                paymentMethod:
                  newPaymentMethod || existing.paymentMethod || 'cash',
                amount: existing.total,
                amountVes:
                  existing.fxRate != null
                    ? round2(existing.total * existing.fxRate)
                    : null,
                fxRate: existing.fxRate ?? null,
                description: `Cobro de venta ${existing.saleNumber ?? id}`,
              },
            });
          } else if (to === 'pending' && from === 'paid') {
            await tx.cashMovement.create({
              data: {
                cashRegisterId: register.id,
                companyId,
                saleId: id,
                type: 'sale',
                paymentMethod: existing.paymentMethod || 'cash',
                amount: -existing.total,
                amountVes:
                  existing.fxRate != null
                    ? round2(-existing.total * existing.fxRate)
                    : null,
                fxRate: existing.fxRate ?? null,
                description: `Reversión a por cobrar de venta ${existing.saleNumber ?? id}`,
              },
            });
          } else if (to === 'cancelled' && from === 'paid') {
            const refund = refundAmount ?? existing.total;
            await tx.cashMovement.create({
              data: {
                cashRegisterId: register.id,
                companyId,
                saleId: id,
                type: 'refund',
                paymentMethod: this.mapRefundMethod(refundMethod),
                amount: -Number(refund),
                amountVes:
                  existing.fxRate != null
                    ? round2(-Number(refund) * existing.fxRate)
                    : null,
                fxRate: existing.fxRate ?? null,
                description: `Reembolso de venta cancelada ${existing.saleNumber ?? id}`,
              },
            });
          }
        }

        return sale;
      });

      return result;
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

  async updateInvoiceStatus(
    id: number,
    status: string,
    companyId?: number,
    userId?: number,
  ) {
    try {
      this.logger.info(`Updating invoice status: ${id}`);
      const existing = await this.prisma.invoice.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      if (!existing) {
        throw new Error('Factura no encontrada');
      }

      const touchesCash = status === 'paid' && existing.status !== 'paid';
      const register = touchesCash
        ? await this.findActiveRegister(companyId, userId)
        : null;
      if (touchesCash && !register) {
        throw new BadRequestException(
          'No hay una caja abierta para registrar el cobro',
        );
      }

      const invoice = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.invoice.update({
          where: { id },
          data: { status },
        });

        // Also update the sale payment status
        await tx.sale.updateMany({
          where: { id: invoice.saleId, ...(companyId ? { companyId } : {}) },
          data: { paymentStatus: status },
        });

        if (touchesCash && register) {
          const sale = await tx.sale.findFirst({
            where: { id: invoice.saleId },
          });
          if (sale) {
            await tx.cashMovement.create({
              data: {
                cashRegisterId: register.id,
                companyId,
                saleId: sale.id,
                type: 'sale',
                paymentMethod: sale.paymentMethod || 'cash',
                amount: sale.total,
                amountVes:
                  sale.fxRate != null ? round2(sale.total * sale.fxRate) : null,
                fxRate: sale.fxRate ?? null,
                description: `Cobro de factura ${invoice.invoiceNumber}`,
              },
            });
          }
        }

        return updated;
      });

      return invoice;
    } catch (error) {
      this.logger.error(`Error updating invoice ${id}:`, error);
      throw error;
    }
  }
}
