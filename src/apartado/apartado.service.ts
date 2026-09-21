import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import {
  CreateApartadoDto,
  AddApartadoPaymentDto,
  CancelApartadoDto,
  CompleteApartadoDto,
} from './apartado.dto';

@Injectable()
export class ApartadoService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  async findAll(companyId?: number, page = 1, limit = 10, status?: string) {
    this.logger.info('Starting ApartadoService findAll');
    const where: Prisma.ApartadoWhereInput & { companyId?: number } = companyId
      ? { companyId }
      : {};
    if (status) {
      where.status = status;
    }
    try {
      const [data, total] = await Promise.all([
        this.prisma.apartado.findMany({
          where,
          include: {
            client: true,
            items: true,
            sale: { select: { id: true, saleNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.apartado.count({ where }),
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
      this.logger.error('Error finding apartados:', error);
      throw error;
    }
  }

  async findById(id: number, companyId?: number) {
    this.logger.info(`Finding apartado by ID: ${id}`);
    try {
      return await this.prisma.apartado.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
        include: {
          client: true,
          items: true,
          payments: { orderBy: { createdAt: 'desc' } },
          sale: { include: { items: true, invoice: true, client: true } },
        },
      });
    } catch (error) {
      this.logger.error(`Error finding apartado ${id}:`, error);
      throw error;
    }
  }

  async create(data: CreateApartadoDto, companyId?: number, userId?: number) {
    try {
      this.logger.info('Creating apartado:', { clientId: data.clientId });

      if (!data.items || data.items.length === 0) {
        throw new BadRequestException(
          'El apartado debe tener al menos un producto',
        );
      }

      const client = await this.prisma.client.findFirst({
        where: {
          id: Number(data.clientId),
          ...(companyId ? { companyId } : {}),
        },
      });
      if (!client) {
        throw new BadRequestException('Cliente no encontrado');
      }

      const items = [];
      for (const item of data.items) {
        const product = await this.prisma.product.findFirst({
          where: {
            id: Number(item.productId),
            ...(companyId ? { companyId } : {}),
          },
        });
        if (!product) {
          throw new BadRequestException(
            `Producto ${item.productId} no encontrado`,
          );
        }
        if (product.stock < Number(item.quantity)) {
          throw new BadRequestException(
            `Stock insuficiente para ${product.name}`,
          );
        }
        const unitPrice = Number(item.unitPrice) || product.salePrice;
        items.push({
          productId: Number(item.productId),
          productName: product.name,
          size: item.size || null,
          quantity: Number(item.quantity),
          unitPrice,
          subtotal: Math.round(unitPrice * Number(item.quantity) * 100) / 100,
        });
      }

      const subtotal =
        Math.round(
          items.reduce((sum: number, i: any) => sum + i.subtotal, 0) * 100,
        ) / 100;
      const tax = Math.round(subtotal * 0.19 * 100) / 100;
      const total = Math.round((subtotal + tax) * 100) / 100;

      const initialPayment = Number(data.initialPayment) || 0;
      if (initialPayment > total) {
        throw new BadRequestException(
          'El anticipo no puede superar el total del apartado',
        );
      }

      let register: any = null;
      if (initialPayment > 0) {
        register = await this.findActiveRegister(companyId, userId);
        if (!register) {
          throw new BadRequestException(
            'No hay una caja abierta para registrar el anticipo',
          );
        }
      }

      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const year = new Date().getFullYear();
        const seq =
          (await this.prisma.apartado.count({
            where: {
              ...(companyId ? { companyId } : {}),
              date: { gte: new Date(`${year}-01-01`) },
            },
          })) + 1;
        const apartadoNumber = `APA-${year}-${String(seq).padStart(4, '0')}`;
        try {
          return await this.createWithNumber(
            data,
            companyId,
            items,
            subtotal,
            tax,
            total,
            initialPayment,
            apartadoNumber,
            register,
          );
        } catch (error: any) {
          if (error?.code !== 'P2002' || attempt === maxAttempts - 1) {
            throw error;
          }
          this.logger.warn('Colisión de número de apartado, reintentando...', {
            apartadoNumber,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error creating apartado:', error);
      throw error;
    }
  }

  private async createWithNumber(
    data: CreateApartadoDto,
    companyId: number | undefined,
    items: any[],
    subtotal: number,
    tax: number,
    total: number,
    initialPayment: number,
    apartadoNumber: string,
    register?: any,
  ) {
    const initialPaymentMethod = data.initialPaymentMethod || 'cash';
    return this.prisma.$transaction(async (tx) => {
      const apartado = await tx.apartado.create({
        data: {
          companyId,
          apartadoNumber,
          clientId: Number(data.clientId),
          date: new Date(data.date),
          subtotal,
          tax,
          total,
          initialPayment,
          totalPaid: initialPayment,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          notes: data.notes || null,
          items: { create: items },
        },
        include: { items: true },
      });

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      if (initialPayment > 0 && register) {
        await tx.apartadoPayment.create({
          data: {
            apartadoId: apartado.id,
            companyId,
            amount: initialPayment,
            paymentMethod: initialPaymentMethod,
            description: `Anticipo de apartado ${apartadoNumber}`,
            cashRegisterId: register.id,
          },
        });
        await tx.cashMovement.create({
          data: {
            cashRegisterId: register.id,
            companyId,
            apartadoId: apartado.id,
            type: 'apartado',
            paymentMethod: initialPaymentMethod,
            amount: initialPayment,
            description: `Anticipo de apartado ${apartadoNumber}`,
          },
        });
      }

      return apartado;
    });
  }

  async addPayment(
    id: number,
    data: AddApartadoPaymentDto,
    companyId?: number,
    userId?: number,
  ) {
    try {
      this.logger.info(`Adding payment to apartado: ${id}`);
      const apartado = await this.getActiveApartado(id, companyId);
      const amount = Number(data.amount);
      if (amount <= 0) {
        throw new BadRequestException('El abono debe ser mayor a cero');
      }
      const remaining =
        Math.round((apartado.total - apartado.totalPaid) * 100) / 100;
      if (amount > remaining + 0.001) {
        throw new BadRequestException(
          `El abono supera el saldo pendiente (${remaining})`,
        );
      }

      const register = await this.findActiveRegister(companyId, userId);
      if (!register) {
        throw new BadRequestException(
          'No hay una caja abierta para registrar el abono',
        );
      }

      const completes = amount >= remaining - 0.001;
      const paymentMethod = data.paymentMethod || 'cash';
      const newTotalPaid =
        Math.round((apartado.totalPaid + amount) * 100) / 100;

      return this.prisma.$transaction(async (tx) => {
        await tx.apartadoPayment.create({
          data: {
            apartadoId: id,
            companyId,
            amount,
            paymentMethod,
            description: `Abono a apartado ${apartado.apartadoNumber}`,
            cashRegisterId: register.id,
          },
        });

        if (completes) {
          const { sale, saleNumber } = await this.createSaleFromApartado(
            tx,
            companyId,
            apartado,
            paymentMethod,
            amount,
          );
          await tx.cashMovement.create({
            data: {
              cashRegisterId: register.id,
              companyId,
              saleId: sale.id,
              apartadoId: id,
              type: 'sale',
              paymentMethod,
              amount,
              description: `Venta por apartado ${apartado.apartadoNumber} (${saleNumber})`,
            },
          });
          await tx.apartado.update({
            where: { id },
            data: { status: 'paid', totalPaid: newTotalPaid, saleId: sale.id },
          });
          return { apartadoId: id, status: 'paid', sale };
        }

        await tx.cashMovement.create({
          data: {
            cashRegisterId: register.id,
            companyId,
            apartadoId: id,
            type: 'apartado',
            paymentMethod,
            amount,
            description: `Abono a apartado ${apartado.apartadoNumber}`,
          },
        });
        await tx.apartado.update({
          where: { id },
          data: { totalPaid: newTotalPaid },
        });
        return {
          apartadoId: id,
          status: 'active',
          totalPaid: newTotalPaid,
          remaining: Math.round((remaining - amount) * 100) / 100,
        };
      });
    } catch (error) {
      this.logger.error(`Error adding payment to apartado ${id}:`, error);
      throw error;
    }
  }

  async complete(
    id: number,
    data: CompleteApartadoDto,
    companyId?: number,
    userId?: number,
  ) {
    try {
      this.logger.info(`Completing apartado: ${id}`);
      const apartado = await this.getActiveApartado(id, companyId);
      const outstanding =
        Math.round((apartado.total - apartado.totalPaid) * 100) / 100;
      const paymentMethod = data.paymentMethod || 'cash';

      let register: any = null;
      if (outstanding > 0) {
        register = await this.findActiveRegister(companyId, userId);
        if (!register) {
          throw new BadRequestException(
            'No hay una caja abierta para cobrar el saldo',
          );
        }
      }

      return this.prisma.$transaction(async (tx) => {
        if (outstanding > 0 && register) {
          await tx.apartadoPayment.create({
            data: {
              apartadoId: id,
              companyId,
              amount: outstanding,
              paymentMethod,
              description: `Saldo de apartado ${apartado.apartadoNumber}`,
              cashRegisterId: register.id,
            },
          });
        }

        const { sale, saleNumber } = await this.createSaleFromApartado(
          tx,
          companyId,
          apartado,
          paymentMethod,
          outstanding,
        );

        if (outstanding > 0 && register) {
          await tx.cashMovement.create({
            data: {
              cashRegisterId: register.id,
              companyId,
              saleId: sale.id,
              apartadoId: id,
              type: 'sale',
              paymentMethod,
              amount: outstanding,
              description: `Venta por apartado ${apartado.apartadoNumber} (${saleNumber})`,
            },
          });
        }

        await tx.apartado.update({
          where: { id },
          data: { status: 'paid', totalPaid: apartado.total, saleId: sale.id },
        });

        return { apartadoId: id, status: 'paid', sale };
      });
    } catch (error) {
      this.logger.error(`Error completing apartado ${id}:`, error);
      throw error;
    }
  }

  async cancel(
    id: number,
    data: CancelApartadoDto,
    companyId?: number,
    userId?: number,
  ) {
    try {
      this.logger.info(`Cancelling apartado: ${id}`);
      const apartado = await this.getActiveApartado(id, companyId);
      const refund = Math.round(apartado.totalPaid * 100) / 100;

      let register: any = null;
      if (refund > 0) {
        register = await this.findActiveRegister(companyId, userId);
        if (!register) {
          throw new BadRequestException(
            'No hay una caja abierta para registrar el reembolso',
          );
        }
      }

      return this.prisma.$transaction(async (tx) => {
        for (const item of apartado.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }

        if (refund > 0 && register) {
          const refundMethod = this.mapRefundMethod(data.refundMethod);
          await tx.cashMovement.create({
            data: {
              cashRegisterId: register.id,
              companyId,
              apartadoId: id,
              type: 'refund',
              paymentMethod: refundMethod,
              amount: -refund,
              description: `Reembolso de apartado cancelado ${apartado.apartadoNumber}`,
            },
          });
        }

        return tx.apartado.update({
          where: { id },
          data: {
            status: 'cancelled',
            notes: data.reason
              ? `${apartado.notes ? apartado.notes + ' | ' : ''}Cancelado: ${data.reason}`
              : apartado.notes,
          },
        });
      });
    } catch (error) {
      this.logger.error(`Error cancelling apartado ${id}:`, error);
      throw error;
    }
  }

  private async getActiveApartado(id: number, companyId?: number) {
    const apartado = await this.prisma.apartado.findFirst({
      where: { id, ...(companyId ? { companyId } : {}) },
      include: { client: true, items: true },
    });
    if (!apartado) {
      throw new NotFoundException('Apartado no encontrado');
    }
    if (apartado.status !== 'active') {
      throw new BadRequestException('El apartado ya está pagado o cancelado');
    }
    return apartado;
  }

  private async createSaleFromApartado(
    tx: Prisma.TransactionClient,
    companyId: number | undefined,
    apartado: any,
    paymentMethod: string,
    receivedAmount: number,
  ) {
    const year = new Date().getFullYear();
    const saleSeq =
      (await tx.sale.count({
        where: {
          ...(companyId ? { companyId } : {}),
          date: { gte: new Date(`${year}-01-01`) },
        },
      })) + 1;
    const saleNumber = `VEN-${year}-${String(saleSeq).padStart(4, '0')}`;
    const invoiceSeq = Math.floor(Math.random() * 9000) + 1000;
    const invoiceNumber = `FAC-${year}-${invoiceSeq}`;

    const sale = await tx.sale.create({
      data: {
        companyId,
        saleNumber,
        clientId: apartado.clientId,
        date: apartado.date,
        subtotal: apartado.subtotal,
        tax: apartado.tax,
        total: apartado.total,
        paymentStatus: 'paid',
        paymentMethod,
        receivedAmount,
        items: {
          create: apartado.items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            size: item.size || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
        },
      },
    });

    await tx.invoice.create({
      data: {
        invoiceNumber,
        saleId: sale.id,
        companyId,
        clientId: apartado.clientId,
        clientName: apartado.client.name,
        clientDocument: apartado.client.document,
        clientAddress: apartado.client.address,
        date: apartado.date,
        subtotal: apartado.subtotal,
        tax: apartado.tax,
        total: apartado.total,
        status: 'paid',
      },
    });

    return { sale, saleNumber, invoiceNumber };
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
}
