import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
// import 'winston-daily-rotate-file'; // For daily file rotation

/**
 * Redacción de PII en los logs (Ley OPDP 1733 — Fase 4 del PLAN_LEGAL.md):
 * los registros de Winston conservan 30 días y no deben contener datos
 * personales ni credenciales.
 */
const BEARER_TOKEN = /\bBearer\s+[\w.-]+/gi;

/** Cabecera completa: `Authorization: Bearer <jwt>` / `authorization=Basic <b64>`. */
const AUTH_HEADER =
  /\b(authorization"?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|(?:Bearer|Basic)\s+[^\s,;)}]+|[^\s,;)}]+)/gi;

const SENSITIVE_FIELD =
  /((?:password|passwd|pwd|secret|token|accessToken|refreshToken|cookie|apiKey|api_key)"?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;)}]+)/gi;

const EMAIL = /[\w.+-]+@[\w.-]+\.[\w.-]+/g;

/** `ana.perez@gmail.com` → `***@gmail.com` (se conserva el dominio). */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  return at <= 0 ? '***' : `***${email.slice(at)}`;
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  try {
    const json = JSON.stringify(value);
    return typeof json === 'string' ? json : '[no serializable]';
  } catch {
    return '[no serializable]';
  }
}

/** Aplica todas las reglas de redacción a cualquier mensaje de log. */
export function redactPii(value: unknown): string {
  return toText(value)
    .replace(AUTH_HEADER, '$1"***"')
    .replace(BEARER_TOKEN, 'Bearer ***')
    .replace(SENSITIVE_FIELD, '$1"***"')
    .replace(EMAIL, maskEmail);
}

/** Formato de Winston que redacta el mensaje antes de imprimirlo. */
const redactPiiFormat = winston.format((info) => {
  info.message = redactPii(info.message);
  return info;
});

const lineFormat = (
  colorize: boolean,
): ReturnType<typeof winston.format.combine> =>
  winston.format.combine(
    winston.format.timestamp(),
    ...(colorize ? [winston.format.colorize()] : []),
    redactPiiFormat(),
    winston.format.printf((info) => {
      // redactPiiFormat ya garantiza que message es string.
      const timestamp = info.timestamp as string;
      const message = info.message as string;
      return `${timestamp} [${info.level}]: ${message}`;
    }),
  );

// Sin LOG_FILE winston lanza al construir el transporte de archivo.
const transports = [
  new winston.transports.Console({
    format: lineFormat(true),
  }),
  ...(process.env.LOG_FILE
    ? [
        new winston.transports.File({
          filename: process.env.LOG_FILE,
          zippedArchive: true,
          maxsize: 5000000,
          maxFiles: 30,
          format: lineFormat(false),
        }),
      ]
    : []),
];

export const winstonConfig: WinstonModuleOptions = { transports };
