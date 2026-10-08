import { redactPii, winstonConfig } from './winston.config';

describe('redactPii — redacción de PII en logs (Fase 4.6)', () => {
  it('enmascara el correo conservando el dominio', () => {
    expect(redactPii('User ana.perez@gmail.com creado con company Ana')).toBe(
      'User ***@gmail.com creado con company Ana',
    );
  });

  it('oculta contraseñas en claro (clave=valor)', () => {
    expect(redactPii('login password=secret123 ok')).toBe(
      'login password="***" ok',
    );
  });

  it('oculta contraseñas en JSON', () => {
    expect(redactPii('{"email":"a@b.co","password":"secret123"}')).toBe(
      '{"email":"***@b.co","password":"***"}',
    );
  });

  it('oculta la cabecera Authorization completa', () => {
    expect(redactPii('Authorization: Bearer eyJhbGciOi.payload.firma')).toBe(
      'Authorization: "***"',
    );
  });

  it('oculta tokens Bearer sueltos', () => {
    expect(redactPii('fallo con Bearer eyJhbGciOi.payload.firma')).toBe(
      'fallo con Bearer ***',
    );
  });

  it('serializa objetos antes de redactarlos', () => {
    expect(redactPii({ password: 'secret123', email: 'ana@test.local' })).toBe(
      '{"password":"***","email":"***@test.local"}',
    );
  });

  it('deja intactos los mensajes sin PII', () => {
    expect(redactPii('Starting ProductController find all')).toBe(
      'Starting ProductController find all',
    );
  });

  it('el formato de los transportes aplica la redacción', () => {
    const transports = Array.isArray(winstonConfig.transports)
      ? winstonConfig.transports
      : [winstonConfig.transports!];

    expect(transports.length).toBeGreaterThan(0);
    for (const transport of transports) {
      const format = transport.format as {
        transform?: (
          info: Record<string, unknown>,
          opts: Record<string, unknown>,
        ) => Record<string, unknown>;
      };
      expect(format?.transform).toBeDefined();
      const info = format.transform!(
        {
          level: 'info',
          message: 'User ana@test.local ok',
          // triple-beam identifica el nivel por este símbolo (colorize lo exige)
          [Symbol.for('level')]: 'info',
        },
        {},
      );
      expect(info.message).toBe('User ***@test.local ok');
    }
  });
});
