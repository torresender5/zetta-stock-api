import { ExecutionContext } from '@nestjs/common';
import { envPositiveInt, isRateLimitedRoute } from './auth.throttle';

const contextFor = (url: string): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ url }) }),
  }) as unknown as ExecutionContext;

describe('auth.throttle (Fase 4)', () => {
  describe('isRateLimitedRoute', () => {
    it.each(['/auth/login', '/auth/register'])('limita %s', (url) =>
      expect(isRateLimitedRoute(contextFor(url))).toBe(true),
    );

    it('ignora la query string', () => {
      expect(isRateLimitedRoute(contextFor('/auth/login?foo=bar'))).toBe(true);
    });

    it.each(['/auth/accept-legal', '/products', '/users/me/export', '/'])(
      'no limita %s',
      (url) => expect(isRateLimitedRoute(contextFor(url))).toBe(false),
    );

    it('no limita la ruta vacía', () => {
      expect(isRateLimitedRoute(contextFor(''))).toBe(false);
    });
  });

  describe('envPositiveInt', () => {
    it('lee el valor del env cuando es un entero positivo', () => {
      process.env.AUTH_RATE_LIMIT_TEST = '25';
      try {
        expect(envPositiveInt('AUTH_RATE_LIMIT_TEST', 10)).toBe(25);
      } finally {
        delete process.env.AUTH_RATE_LIMIT_TEST;
      }
    });

    it('usa el valor por defecto si el env falta o es inválido', () => {
      expect(envPositiveInt('AUTH_RATE_LIMIT_TEST', 10)).toBe(10);
      process.env.AUTH_RATE_LIMIT_TEST = 'no-numero';
      try {
        expect(envPositiveInt('AUTH_RATE_LIMIT_TEST', 10)).toBe(10);
      } finally {
        delete process.env.AUTH_RATE_LIMIT_TEST;
      }
    });
  });
});
