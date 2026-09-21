import { Inject, Injectable } from '@nestjs/common';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import {
  CreateCashMovementDto,
  OpenCashRegisterDto,
} from './dto/cash-register.dto';

@Injectable()
export class CashRegisterService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  async findAll(companyId?: number, status?: string, page = 1, limit = 20) {
    this.logger.info('Starting CashRegisterService findAll');
    const where = {
      ...(companyId ? { companyId } : {}),
      ...(status ? { status } : {}),
    };
    try {
      const [data, total] = await Promise.all([
        this.prisma.cashRegister.findMany({
          where,
          include: { user: true },
          orderBy: { openedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.cashRegister.count({ where }),
      ]);
      const sanitized = data.map(({ user, ...register }) => ({
        ...register,
        user: user ? { name: user.user, role: user.role } : null,
      }));
      return {
        data: sanitized,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    } catch (error) {
      this.logger.error('Error finding cash registers:', error);
      throw error;
    }
  }

  async findById(id: number, companyId?: number) {
    this.logger.info(`Finding cash register by ID: ${id}`);
    try {
      const result = await this.prisma.cashRegister.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
        include: {
          user: true,
          movements: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!result) {
        return null;
      }
      const { user, ...register } = result;
      return {
        ...register,
        user: user ? { name: user.user, role: user.role } : null,
      };
    } catch (error) {
      this.logger.error(`Error finding cash register ${id}:`, error);
      throw error;
    }
  }

  async findActive(userId?: number, companyId?: number) {
    this.logger.info('Finding active cash register');
    return this.prisma.cashRegister.findFirst({
      where: {
        status: 'open',
        ...(companyId ? { companyId } : {}),
        ...(userId ? { userId } : {}),
      },
      include: { user: true },
      orderBy: { openedAt: 'desc' },
    });
  }

  async open(userId: number, data: OpenCashRegisterDto, companyId?: number) {
    this.logger.info('Opening cash register', {
      userId,
      baseAmount: data.baseAmount,
    });
    try {
      const existing = await this.prisma.cashRegister.findFirst({
        where: {
          status: 'open',
          ...(companyId ? { companyId } : {}),
          userId,
        },
      });
      if (existing) {
        throw new BadRequestException(
          'Ya existe una caja abierta para este usuario',
        );
      }

      const name =
        data.name ||
        `Caja ${new Date().toLocaleDateString('es-CO', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}`;

      const register = await this.prisma.$transaction(async (tx) => {
        const created = await tx.cashRegister.create({
          data: {
            companyId,
            userId,
            name,
            baseAmount: Number(data.baseAmount),
            status: 'open',
          },
        });
        await tx.cashMovement.create({
          data: {
            cashRegisterId: created.id,
            companyId,
            type: 'opening',
            paymentMethod: 'cash',
            amount: Number(data.baseAmount),
            description: 'Apertura de caja',
          },
        });
        return created;
      });

      return register;
    } catch (error) {
      this.logger.error('Error opening cash register:', error);
      throw error;
    }
  }

  async addMovement(
    id: number,
    data: CreateCashMovementDto,
    companyId?: number,
  ) {
    this.logger.info(`Adding movement to cash register: ${id}`);
    try {
      const register = await this.prisma.cashRegister.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
      });
      if (!register) {
        throw new NotFoundException('Caja no encontrada');
      }
      if (register.status !== 'open') {
        throw new BadRequestException('La caja no está abierta');
      }

      const signed =
        data.type === 'deposit' ? Number(data.amount) : -Number(data.amount);

      return this.prisma.cashMovement.create({
        data: {
          cashRegisterId: id,
          companyId,
          type: data.type,
          paymentMethod: data.paymentMethod,
          amount: signed,
          description: data.description || null,
        },
      });
    } catch (error) {
      this.logger.error(`Error adding movement to cash register ${id}:`, error);
      throw error;
    }
  }

  async close(
    id: number,
    countedByMethod: Record<string, number>,
    companyId?: number,
  ) {
    this.logger.info(`Closing cash register: ${id}`);
    try {
      const register = await this.prisma.cashRegister.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
        include: { movements: true },
      });
      if (!register) {
        throw new NotFoundException('Caja no encontrada');
      }
      if (register.status !== 'open') {
        throw new BadRequestException('La caja ya está cerrada');
      }

      const expectedTotal =
        register.baseAmount +
        register.movements
          .filter((m) => m.type !== 'opening' && m.type !== 'closing')
          .reduce((sum, m) => sum + m.amount, 0);
      const countedTotal = Object.values(countedByMethod).reduce(
        (sum, v) => sum + Number(v || 0),
        0,
      );
      const difference = countedTotal - expectedTotal;

      const closed = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.cashRegister.update({
          where: { id },
          data: {
            status: 'closed',
            closedAt: new Date(),
            expectedTotal,
            countedTotal,
            difference,
          },
        });
        await tx.cashMovement.create({
          data: {
            cashRegisterId: id,
            companyId,
            type: 'closing',
            paymentMethod: 'cash',
            amount: 0,
            description: `Cierre de caja. Esperado: ${expectedTotal}, Contado: ${countedTotal}, Diferencia: ${difference >= 0 ? 'Sobrante' : 'Faltante'} ${Math.abs(
              difference,
            )}`,
          },
        });
        return updated;
      });

      return closed;
    } catch (error) {
      this.logger.error(`Error closing cash register ${id}:`, error);
      throw error;
    }
  }

  async getSummary(id: number, companyId?: number) {
    this.logger.info(`Getting summary for cash register: ${id}`);
    try {
      const register = await this.prisma.cashRegister.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
        include: { movements: true },
      });
      if (!register) {
        throw new NotFoundException('Caja no encontrada');
      }

      const salesByMethod: Record<string, number> = {};
      const expectedByMethod: Record<string, number> = {};
      let salesTotal = 0;
      let outcomesTotal = 0;
      let incomesTotal = 0;
      let expectedTotal = register.baseAmount;

      for (const m of register.movements) {
        if (m.type === 'opening' || m.type === 'closing') {
          continue;
        }
        expectedTotal += m.amount;
        expectedByMethod[m.paymentMethod] =
          (expectedByMethod[m.paymentMethod] || 0) + m.amount;
        if (m.type === 'sale') {
          salesTotal += m.amount;
          salesByMethod[m.paymentMethod] =
            (salesByMethod[m.paymentMethod] || 0) + m.amount;
        } else if (m.type === 'expense' || m.type === 'withdrawal') {
          outcomesTotal += m.amount;
        } else if (m.type === 'deposit' || m.type === 'apartado') {
          incomesTotal += m.amount;
        }
      }

      expectedByMethod.cash =
        (expectedByMethod.cash || 0) + register.baseAmount;

      return {
        baseAmount: register.baseAmount,
        expectedTotal,
        countedTotal: register.countedTotal,
        difference: register.difference,
        status: register.status,
        salesTotal,
        outcomesTotal,
        incomesTotal,
        salesByMethod,
        expectedByMethod,
        movementCount: register.movements.length,
      };
    } catch (error) {
      this.logger.error(
        `Error getting summary for cash register ${id}:`,
        error,
      );
      throw error;
    }
  }
}
