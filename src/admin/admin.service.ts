import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from 'src/prisma/prisma.service';

const LOW_STOCK_THRESHOLD = 10;

@Injectable()
export class AdminService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private dateRange(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) {
      return undefined;
    }
    const base: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      base.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      base.lte = end;
    }
    return base;
  }

  /** Effective end de la suscripción: corte de prueba o vencimiento. */
  private effectiveEnd(sub: {
    trialEndsAt: Date | null;
    expiresAt: Date | null;
  }) {
    return sub.trialEndsAt ?? sub.expiresAt;
  }

  // ------------------------------------------------------------------
  // Dashboard global
  // ------------------------------------------------------------------

  async dashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      totalCompanies,
      activeCompanies,
      newLast30Days,
      totalUsers,
      subscriptions,
      pendingOrders,
      monthSales,
      monthPurchases,
      plans,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { active: true } }),
      this.prisma.company.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.user.count(),
      this.prisma.subscription.findMany({
        include: { plan: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.paymentOrder.count({ where: { status: 'pending' } }),
      this.prisma.sale.aggregate({
        where: {
          date: { gte: monthStart },
          paymentStatus: { not: 'cancelled' },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.purchase.aggregate({
        where: { date: { gte: monthStart } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]);

    const active = subscriptions.filter((sub) => {
      const end = this.effectiveEnd(sub);
      return sub.status === 'active' && (!end || end.getTime() > now.getTime());
    });
    const expired = subscriptions.filter((sub) => {
      const end = this.effectiveEnd(sub);
      return (
        sub.status !== 'active' || (!!end && end.getTime() <= now.getTime())
      );
    });
    const expiringSoon = active.filter((sub) => {
      const end = this.effectiveEnd(sub);
      return (
        !!end &&
        end.getTime() > now.getTime() &&
        end.getTime() <= sevenDaysFromNow.getTime()
      );
    });

    const mrv = active
      .filter(
        (sub) =>
          sub.price > 0 &&
          (sub.period === 'monthly' || sub.period === 'yearly'),
      )
      .reduce(
        (sum, sub) =>
          sum + (sub.period === 'monthly' ? sub.price : sub.price / 12),
        0,
      );

    const planDistribution = plans.map((plan) => ({
      id: plan.id,
      key: plan.key,
      name: plan.name,
      companies: subscriptions.filter((sub) => sub.planId === plan.id).length,
    }));

    // Ventas de los últimos 6 meses por empresa (top 5).
    const recentSales = await this.prisma.sale.findMany({
      where: {
        date: { gte: sixMonthsAgo },
        paymentStatus: { not: 'cancelled' },
        companyId: { not: null },
      },
      include: { company: { select: { name: true } } },
    });
    const companiesBySale = new Map<
      number,
      { id: number; name: string; total: number; count: number }
    >();
    for (const sale of recentSales) {
      if (sale.companyId === null) continue;
      const current = companiesBySale.get(sale.companyId) ?? {
        id: sale.companyId,
        name: sale.company?.name ?? '—',
        total: 0,
        count: 0,
      };
      current.total = this.round(current.total + sale.total);
      current.count += 1;
      companiesBySale.set(sale.companyId, current);
    }
    const topCompanies = [...companiesBySale.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Empresas registradas por mes (últimos 6 meses).
    const recentCompanies = await this.prisma.company.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    });
    const registrations = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      registrations.set(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        0,
      );
    }
    for (const company of recentCompanies) {
      const d = company.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (registrations.has(key)) {
        registrations.set(key, (registrations.get(key) ?? 0) + 1);
      }
    }
    const registrationsByMonth = [...registrations.entries()].map(
      ([month, count]) => ({ month, count }),
    );

    return {
      companies: {
        total: totalCompanies,
        active: activeCompanies,
        inactive: totalCompanies - activeCompanies,
        newLast30Days,
      },
      users: { total: totalUsers },
      subscriptions: {
        active: active.length,
        expired: expired.length,
        trial: active.filter((sub) => sub.period === 'trial').length,
        paidMonthly: active.filter((sub) => sub.period === 'monthly').length,
        paidYearly: active.filter((sub) => sub.period === 'yearly').length,
        expiringSoon: expiringSoon.length,
      },
      mrv: this.round(mrv),
      pendingOrders,
      monthSales: {
        total: this.round(monthSales._sum.total ?? 0),
        count: monthSales._count,
      },
      monthPurchases: {
        total: this.round(monthPurchases._sum.total ?? 0),
        count: monthPurchases._count,
      },
      plans: planDistribution,
      topCompanies,
      registrationsByMonth,
    };
  }

  // ------------------------------------------------------------------
  // Empresas (tenants)
  // ------------------------------------------------------------------

  async companies(search?: string) {
    const rows = await this.prisma.company.findMany({
      where: search
        ? { name: { contains: search, mode: 'insensitive' } }
        : undefined,
      include: {
        users: { select: { role: true } },
        subscription: {
          select: {
            status: true,
            period: true,
            plan: { select: { key: true, name: true } },
          },
        },
        sales: {
          select: { date: true, total: true },
          orderBy: { date: 'desc' },
          take: 1,
        },
        _count: { select: { sales: true, products: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((company) => ({
      id: company.id,
      name: company.name,
      kind: company.kind,
      document: company.document,
      phoneNumber: company.phoneNumber,
      address: company.address,
      active: company.active,
      createdAt: company.createdAt,
      usersCount: company.users.length,
      salesCount: company._count.sales,
      productsCount: company._count.products,
      lastSaleAt: company.sales[0]?.date ?? null,
      lastSaleTotal: company.sales[0]?.total ?? null,
      plan: company.subscription?.plan ?? null,
      subscriptionStatus: company.subscription?.status ?? null,
      period: company.subscription?.period ?? null,
    }));
  }

  async companyDetail(id: number) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            user: true,
            email: true,
            role: true,
            active: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        subscription: { include: { plan: true } },
        _count: {
          select: {
            sales: true,
            products: true,
            clients: true,
            suppliers: true,
            purchases: true,
          },
        },
      },
    });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }
    const lastSales = await this.prisma.sale.findMany({
      where: { companyId: id },
      orderBy: { date: 'desc' },
      take: 10,
      select: {
        id: true,
        date: true,
        total: true,
        paymentStatus: true,
        client: { select: { name: true } },
      },
    });
    return {
      ...company,
      lastSales: lastSales.map((sale) => ({
        id: sale.id,
        date: sale.date,
        total: sale.total,
        paymentStatus: sale.paymentStatus,
        clientName: sale.client?.name ?? '—',
      })),
    };
  }

  async setCompanyStatus(id: number, active: boolean) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }
    await this.prisma.company.update({ where: { id }, data: { active } });
    this.logger.info(
      `Empresa ${id} (${company.name}) ${active ? 'activada' : 'desactivada'}`,
    );
    return { ok: true, active };
  }

  // ------------------------------------------------------------------
  // Usuarios del sistema
  // ------------------------------------------------------------------

  async users(search?: string) {
    const rows = await this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { user: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              {
                company: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : undefined,
      include: { company: { select: { id: true, name: true, active: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return rows.map((user) => ({
      id: user.id,
      name: user.user,
      email: user.email,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      companyActive: user.company?.active ?? null,
    }));
  }

  async setUserStatus(id: number, active: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    await this.prisma.user.update({ where: { id }, data: { active } });
    this.logger.info(
      `Usuario ${id} (${user.email}) ${active ? 'activado' : 'desactivado'}`,
    );
    return { ok: true, active };
  }

  // ------------------------------------------------------------------
  // Consolidado de negocio global
  // ------------------------------------------------------------------

  async business(startDate?: string, endDate?: string) {
    const dateRange = this.dateRange(startDate, endDate);
    const baseWhere = dateRange ? { date: dateRange } : {};

    const [sales, purchases, lowStockRows] = await Promise.all([
      this.prisma.sale.findMany({
        where: { ...baseWhere, paymentStatus: { not: 'cancelled' } },
        include: {
          items: true,
          company: { select: { id: true, name: true } },
        },
      }),
      this.prisma.purchase.findMany({
        where: baseWhere,
        include: { company: { select: { id: true, name: true } } },
      }),
      this.prisma.product.findMany({
        where: { stock: { lt: LOW_STOCK_THRESHOLD } },
        include: { company: { select: { name: true } } },
        orderBy: { stock: 'asc' },
        take: 100,
      }),
    ]);

    const salesTotal = this.round(
      sales.reduce((sum, sale) => sum + sale.total, 0),
    );
    const purchasesTotal = this.round(
      purchases.reduce((sum, purchase) => sum + purchase.total, 0),
    );

    const byMethod: Record<string, number> = {};
    for (const sale of sales) {
      const method = sale.paymentMethod || 'cash';
      byMethod[method] = this.round((byMethod[method] || 0) + sale.total);
    }

    const productsMap = new Map<
      number,
      { productId: number; name: string; quantity: number; revenue: number }
    >();
    for (const sale of sales) {
      for (const item of sale.items) {
        const current = productsMap.get(item.productId) ?? {
          productId: item.productId,
          name: item.productName,
          quantity: 0,
          revenue: 0,
        };
        current.quantity += item.quantity;
        current.revenue = this.round(current.revenue + item.subtotal);
        productsMap.set(item.productId, current);
      }
    }
    const topProducts = [...productsMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const groupByCompany = (
      rows: Array<{
        total: number;
        companyId: number | null;
        company?: { id: number; name: string } | null;
      }>,
    ) => {
      const map = new Map<
        number,
        { companyId: number; name: string; total: number; count: number }
      >();
      for (const row of rows) {
        if (row.companyId === null) continue;
        const current = map.get(row.companyId) ?? {
          companyId: row.companyId,
          name: row.company?.name ?? '—',
          total: 0,
          count: 0,
        };
        current.total = this.round(current.total + row.total);
        current.count += 1;
        map.set(row.companyId, current);
      }
      return [...map.values()].sort((a, b) => b.total - a.total);
    };

    const receivables = groupByCompany(
      sales.filter((sale) => sale.paymentStatus === 'pending'),
    );
    const payables = groupByCompany(
      purchases.filter((purchase) => purchase.paymentStatus === 'pending'),
    );

    return {
      sales: { total: salesTotal, count: sales.length },
      purchases: { total: purchasesTotal, count: purchases.length },
      byMethod,
      topProducts,
      lowStock: lowStockRows.map((product) => ({
        id: product.id,
        name: product.name,
        code: product.code,
        stock: product.stock,
        companyName: product.company?.name ?? '—',
      })),
      receivables,
      payables,
    };
  }
}
