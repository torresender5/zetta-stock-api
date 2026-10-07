import { NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface SettleableOrder {
  id: number;
  companyId: number;
  planKey: string;
  period: string;
  amount: number;
}

/** Suma meses a una fecha. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Marca una orden de pago como pagada y activa/renueva la suscripción de la
 * empresa en una sola transacción. Usado por la confirmación manual del
 * superadmin y por los webhooks de Stripe/Pabilo.
 *
 * Lanza NotFoundException si la orden no existe o su plan ya no existe.
 */
export async function settlePaymentOrder(
  prisma: PrismaService,
  order: SettleableOrder,
): Promise<{ ok: true }> {
  const plan = await prisma.plan.findUnique({
    where: { key: order.planKey },
  });
  if (!plan) {
    throw new NotFoundException('Plan no encontrado');
  }

  const base = new Date();
  const expiresAt =
    order.period === 'yearly' ? addMonths(base, 12) : addMonths(base, 1);

  await prisma.$transaction([
    prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'paid', paidAt: new Date() },
    }),
    prisma.subscription.upsert({
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

  return { ok: true };
}
