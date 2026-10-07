import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { AuthUserPayload } from './auth-user.interface';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const contextWithUser = (user?: AuthUserPayload): ExecutionContext =>
    ({
      getHandler: () => function handler() {},
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('permite el acceso cuando la ruta no exige roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(contextWithUser())).toBe(true);
  });

  it('permite el acceso cuando el rol está permitido', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(
      guard.canActivate(contextWithUser({ sub: 1, role: 'admin', name: 'a' })),
    ).toBe(true);
  });

  it('bloquea a usuarios con otro rol', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(() =>
      guard.canActivate(
        contextWithUser({ sub: 2, role: 'vendedor', name: 'v' }),
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(
        contextWithUser({ sub: 2, role: 'vendedor', name: 'v' }),
      ),
    ).toThrow('No tienes permisos para esta acción');
  });

  it('permite al UserAdmin (sin rol) en rutas con roles exigidos', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(guard.canActivate(contextWithUser({ sub: 99, name: 'root' }))).toBe(
      true,
    );
  });

  it('bloquea si no hay usuario autenticado', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(
      'Acceso restringido',
    );
  });
});
