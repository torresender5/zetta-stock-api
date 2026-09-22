import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SubscriptionGuard } from './subscription.guard';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUserPayload } from '../auth/auth-user.interface';

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;
  const prisma = { subscription: { findUnique: jest.fn() } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    guard = module.get<SubscriptionGuard>(SubscriptionGuard);
  });

  function context(
    user: AuthUserPayload | undefined,
    path: string,
  ): ExecutionContext {
    const request = { user, path };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('permite rutas sin usuario', async () => {
    await expect(
      guard.canActivate(context(undefined, '/products')),
    ).resolves.toBe(true);
  });

  it('permite al superadmin (sin companyId)', async () => {
    await expect(
      guard.canActivate(context({ sub: 1, name: 'admin' }, '/admin/plans')),
    ).resolves.toBe(true);
  });

  it('permite rutas de renovación aunque esté vencido', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ status: 'active' });
    await expect(
      guard.canActivate(
        context({ sub: 2, companyId: 5, name: 'user' }, '/subscription/me'),
      ),
    ).resolves.toBe(true);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it('bloquea a empresas con prueba vencida', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      status: 'active',
      trialEndsAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(
      guard.canActivate(
        context({ sub: 2, companyId: 5, name: 'user' }, '/products'),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('permite a empresas con prueba vigente', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      status: 'active',
      trialEndsAt: new Date(Date.now() + 86400000),
      expiresAt: new Date(Date.now() + 86400000),
    });
    await expect(
      guard.canActivate(
        context({ sub: 2, companyId: 5, name: 'user' }, '/products'),
      ),
    ).resolves.toBe(true);
  });

  it('permite a empresas sin suscripción registrada', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(
        context({ sub: 2, companyId: 5, name: 'user' }, '/products'),
      ),
    ).resolves.toBe(true);
  });
});
