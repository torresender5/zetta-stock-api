import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  FREE_PLAN_KEY,
  SUBSCRIPTION_PERIODS,
  TRIAL_DEFAULT_DAYS,
} from './subscription.constant';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { PurchaseSubscriptionDto } from './dto/purchase.dto';

interface PlanRecord {
  id: number;
  key: string;
  name: string;
  description: string | null;
  features: Prisma.JsonValue | null;
  allowedViews: Prisma.JsonValue | null;
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number;
  trialDays: number | null;
  sortOrder: number;
  active: boolean;
}

interface PaymentOrderRecord {
  id: number;
  companyId: number;
  planKey: string;
  period: string;
  amount: number;
  concept: string;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
}

type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: { plan: true };
}>;

export interface SerializedPlan {
  id: number;
  key: string;
  name: string;
  description: string | null;
  features: string[];
  allowedViews: string[];
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number;
  trialDays: number | null;
  sortOrder: number;
  active: boolean;
}

export interface SerializedSubscription {
  id: number;
  status: string;
  period: string;
  price: number;
  startsAt: Date;
  trialEndsAt: Date | null;
  expiresAt: Date | null;
  effectiveEnd: Date | null;
  plan: SerializedPlan | null;
}

export interface SerializedPaymentOrder {
  id: number;
  planKey: string;
  period: string;
  amount: number;
  concept: string;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function serializePlan(plan: PlanRecord): SerializedPlan {
  return {
    id: plan.id,
    key: plan.key,
    name: plan.name,
    description: plan.description,
    features: (plan.features as string[]) ?? [],
    allowedViews: (plan.allowedViews as string[]) ?? [],
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    maxUsers: plan.maxUsers,
    trialDays: plan.trialDays,
    sortOrder: plan.sortOrder,
    active: plan.active,
  };
}

function serializeSubscription(
  sub: SubscriptionWithPlan,
): SerializedSubscription {
  return {
    id: sub.id,
    status: sub.status,
    period: sub.period,
    price: sub.price,
    startsAt: sub.startsAt,
    trialEndsAt: sub.trialEndsAt,
    expiresAt: sub.expiresAt,
    effectiveEnd: sub.trialEndsAt ?? sub.expiresAt,
    plan: sub.plan ? serializePlan(sub.plan) : null,
  };
}

function serializeOrder(order: PaymentOrderRecord): SerializedPaymentOrder {
  return {
    id: order.id,
    planKey: order.planKey,
    period: order.period,
    amount: order.amount,
    concept: order.concept,
    status: order.status,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
  };
}

@Injectable()
export class SubscriptionService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  /** Planes activos visibles en el catálogo (público). */
  async listActivePlans() {
    const plans = await this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    return plans.map(serializePlan);
  }

  /** Suscripción actual + órdenes de pago de la empresa. */
  async getMySubscription(companyId: number) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    const orders = await this.prisma.paymentOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      subscription: subscription ? serializeSubscription(subscription) : null,
      paymentOrders: orders.map(serializeOrder),
    };
  }

  /** Inicia la compra/renovación. Los planes gratis se activan al instante. */
  async purchase(
    companyId: number,
    dto: PurchaseSubscriptionDto,
  ): Promise<{
    subscription: SerializedSubscription | null;
    order: SerializedPaymentOrder | null;
  }> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan || !plan.active) {
      throw new NotFoundException('Plan no encontrado');
    }
    if (!SUBSCRIPTION_PERIODS.includes(dto.period)) {
      throw new BadRequestException('Período inválido');
    }
    const amount =
      dto.period === 'yearly' ? plan.priceYearly : plan.priceMonthly;

    const current = await this.prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });

    // Plan gratuito: se reinicia la prueba sin orden de pago.
    if (amount === 0) {
      const trialDays = plan.trialDays ?? TRIAL_DEFAULT_DAYS;
      const trialEndsAt = new Date(Date.now() + trialDays * 86400000);
      const subscription = await this.prisma.subscription.upsert({
        where: { companyId },
        update: {
          planId: plan.id,
          status: 'active',
          period: 'trial',
          price: 0,
          startsAt: new Date(),
          trialEndsAt,
          expiresAt: trialEndsAt,
        },
        create: {
          companyId,
          planId: plan.id,
          status: 'active',
          period: 'trial',
          price: 0,
          startsAt: new Date(),
          trialEndsAt,
          expiresAt: trialEndsAt,
        },
        include: { plan: true },
      });
      return { subscription: serializeSubscription(subscription), order: null };
    }

    // Plan pago: se genera la orden pendiente; se activa al confirmarse.
    const order = await this.prisma.paymentOrder.create({
      data: {
        companyId,
        planKey: plan.key,
        period: dto.period,
        amount,
        concept: `Suscripción ${plan.name} ${
          dto.period === 'yearly' ? 'anual' : 'mensual'
        }`,
      },
    });

    return {
      subscription: current ? serializeSubscription(current) : null,
      order: serializeOrder(order),
    };
  }

  /** Superadmin confirma el pago de una orden y activa la suscripción. */
  async confirmPaymentOrder(orderId: number) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Orden de pago no encontrada');
    }
    if (order.status !== 'pending') {
      throw new BadRequestException('La orden ya fue procesada');
    }
    const plan = await this.prisma.plan.findUnique({
      where: { key: order.planKey },
    });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado');
    }

    const base = new Date();
    const expiresAt =
      order.period === 'yearly' ? addMonths(base, 12) : addMonths(base, 1);

    await this.prisma.$transaction([
      this.prisma.paymentOrder.update({
        where: { id: orderId },
        data: { status: 'paid', paidAt: new Date() },
      }),
      this.prisma.subscription.upsert({
        where: { companyId: order.companyId },
        create: {
          companyId: order.companyId,
          planId: plan.id,
          status: 'active',
          period: order.period,
          price: order.amount,
          startsAt: base,
          trialEndsAt: null,
          expiresAt,
        },
        update: {
          planId: plan.id,
          status: 'active',
          period: order.period,
          price: order.amount,
          startsAt: base,
          trialEndsAt: null,
          expiresAt,
        },
      }),
    ]);
    this.logger.info(
      `Pago confirmado: orden ${orderId}, empresa ${order.companyId}`,
    );
    return { ok: true };
  }

  /** Superadmin rechaza una orden de pago pendiente. */
  async rejectPaymentOrder(orderId: number) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Orden de pago no encontrada');
    }
    if (order.status !== 'pending') {
      throw new BadRequestException('La orden ya fue procesada');
    }
    await this.prisma.paymentOrder.update({
      where: { id: orderId },
      data: { status: 'rejected' },
    });
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Administración de planes (superadmin)
  // ------------------------------------------------------------------

  async findAllPlans() {
    const plans = await this.prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return plans.map(serializePlan);
  }

  async createPlan(dto: CreatePlanDto) {
    const existing = await this.prisma.plan.findUnique({
      where: { key: dto.key },
    });
    if (existing) {
      throw new BadRequestException('Ya existe un plan con esa clave');
    }
    const plan = await this.prisma.plan.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        features: (dto.features as unknown as object) ?? [],
        allowedViews: (dto.allowedViews as unknown as object) ?? [],
        priceMonthly: dto.priceMonthly ?? 0,
        priceYearly: dto.priceYearly ?? 0,
        maxUsers: dto.maxUsers ?? 1,
        trialDays: dto.trialDays ?? null,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return serializePlan(plan);
  }

  async updatePlan(id: number, dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado');
    }
    const updated = await this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.key !== undefined ? { key: dto.key } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.features !== undefined
          ? { features: (dto.features as unknown as object) ?? [] }
          : {}),
        ...(dto.allowedViews !== undefined
          ? { allowedViews: (dto.allowedViews as unknown as object) ?? [] }
          : {}),
        ...(dto.priceMonthly !== undefined
          ? { priceMonthly: dto.priceMonthly }
          : {}),
        ...(dto.priceYearly !== undefined
          ? { priceYearly: dto.priceYearly }
          : {}),
        ...(dto.maxUsers !== undefined ? { maxUsers: dto.maxUsers } : {}),
        ...(dto.trialDays !== undefined ? { trialDays: dto.trialDays } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return serializePlan(updated);
  }

  async removePlan(id: number) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan no encontrado');
    }
    if (plan.key === FREE_PLAN_KEY) {
      throw new BadRequestException('El plan gratuito no se puede eliminar');
    }
    const used = await this.prisma.subscription.count({
      where: { planId: id },
    });
    if (used > 0) {
      throw new BadRequestException(
        'El plan está en uso y no se puede eliminar; desactívalo en su lugar',
      );
    }
    await this.prisma.plan.delete({ where: { id } });
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Listados para el superadmin
  // ------------------------------------------------------------------

  async listSubscriptions() {
    const rows = await this.prisma.subscription.findMany({
      include: {
        plan: true,
        company: { include: { users: { select: { role: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((sub) => ({
      id: sub.id,
      companyId: sub.companyId,
      companyName: sub.company.name,
      status: sub.status,
      period: sub.period,
      price: sub.price,
      startsAt: sub.startsAt,
      trialEndsAt: sub.trialEndsAt,
      expiresAt: sub.expiresAt,
      effectiveEnd: sub.trialEndsAt ?? sub.expiresAt,
      plan: serializePlan(sub.plan),
      userCount: sub.company.users.length,
    }));
  }

  async listPaymentOrders() {
    const rows = await this.prisma.paymentOrder.findMany({
      include: { company: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((order) => ({
      id: order.id,
      companyId: order.companyId,
      companyName: order.company.name,
      planKey: order.planKey,
      period: order.period,
      amount: order.amount,
      concept: order.concept,
      status: order.status,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    }));
  }
}
