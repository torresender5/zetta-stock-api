import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ConsentMeta } from '../users/interface/user.interface';
import {
  CreateDataSubjectRequestDto,
  DataSubjectType,
} from './dto/data-subject.dto';

/** SLA de respuesta a solicitudes ARCO: 15 días hábiles (Política de Privacidad §8). */
export const SLA_BUSINESS_DAYS = 15;

/** Dominio sintético: el correo anonimizado no puede recibir mensajes. */
const ANON_EMAIL_DOMAIN = 'zettastock.invalid';

const DETAIL_BY_TYPE: Record<DataSubjectType, string> = {
  acceso:
    'Autoservicio: los datos del titular se descargan con GET /users/me/export.',
  rectificacion:
    'Autoservicio: el titular puede corregir su perfil con PATCH /users/me. ' +
    'Si la rectificación afecta a otros datos, se atiende dentro del SLA.',
  revocacion:
    'Revocación registrada: quedan revocados los consentimientos no ' +
    'esenciales (p. ej. comunicaciones de marketing). Los consentimientos ' +
    'ligados al contrato solo cesan con la baja de la cuenta.',
  supresion:
    'Cuenta desactivada y datos de acceso anonimizados. Los registros ' +
    'contables y de venta se conservan por obligación legal (ver Política ' +
    'de Privacidad, sección 7).',
};

@Injectable()
export class DataSubjectService {
  constructor(
    private prisma: PrismaService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /** Paquete JSON con los datos personales del titular (derecho de acceso). */
  async exportUserData(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        consentLogs: { orderBy: { acceptedAt: 'asc' } },
        dataSubjectRequests: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    this.logger.info(`Exportando datos del usuario ${userId}`);
    return {
      generadoEn: new Date().toISOString(),
      perfil: {
        id: user.id,
        nombre: user.user,
        email: user.email,
        rol: user.role,
        activo: user.active,
        registroEn: user.createdAt,
        aceptoTerminos: user.acceptedTerms,
        versionTerminos: user.termsVersion,
        aceptoEn: user.acceptedAt,
      },
      empresa: user.company
        ? {
            id: user.company.id,
            nombre: user.company.name,
            tipo: user.company.kind,
            documento: user.company.document,
            telefono: user.company.phoneNumber,
            direccion: user.company.address,
            moneda: user.company.currency,
            tasaIva: user.company.taxRate,
            registroEn: user.company.createdAt,
          }
        : null,
      consentimientos: user.consentLogs.map((log) => ({
        tipo: log.type,
        version: log.version,
        aceptadoEn: log.acceptedAt,
        ip: log.ip,
        agenteUsuario: log.userAgent,
      })),
      solicitudes: user.dataSubjectRequests.map((req) => ({
        id: req.id,
        tipo: req.type,
        motivo: req.motivo,
        estado: req.status,
        detalle: req.detail,
        creadaEn: req.createdAt,
        limiteRespuesta: req.dueAt,
        resueltaEn: req.resolvedAt,
      })),
    };
  }

  /** Historial de solicitudes ARCO del propio titular. */
  async listRequests(userId: number) {
    return this.prisma.dataSubjectRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Registra la solicitud ARCO y, cuando el derecho es ejercible por el
   * propio titular, la resuelve de inmediato (acceso, revocación y supresión).
   * La rectificación queda pendiente de atención por soporte dentro del SLA.
   */
  async createRequest(
    userId: number,
    dto: CreateDataSubjectRequestDto,
    meta: ConsentMeta,
  ) {
    const request = await this.prisma.dataSubjectRequest.create({
      data: {
        userId,
        type: dto.type,
        motivo: dto.motivo,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        dueAt: this.addBusinessDays(new Date(), SLA_BUSINESS_DAYS),
      },
    });
    this.logger.info(
      `Solicitud ARCO ${request.type} (#${request.id}) del usuario ${userId}`,
    );

    if (request.type === 'supresion') {
      return this.executeSuppression(userId, request.id);
    }

    const resolvedAt = request.type === 'rectificacion' ? null : new Date();
    return this.prisma.dataSubjectRequest.update({
      where: { id: request.id },
      data: {
        detail: DETAIL_BY_TYPE[request.type as DataSubjectType],
        ...(resolvedAt
          ? { status: 'completada', resolvedAt }
          : { status: 'pendiente' }),
      },
    });
  }

  /**
   * Supresión = baja + anonimización (nunca hard delete: los datos están
   * ligados a ventas/facturas con FK RESTRICT y a obligaciones fiscales).
   * Los ConsentLog se conservan como prueba de la aceptación legal.
   */
  private async executeSuppression(userId: number, requestId: number) {
    const anonymizedEmail = `anonimo+${userId}@${ANON_EMAIL_DOMAIN}`;
    const unreachablePassword = bcrypt.hashSync(
      randomBytes(32).toString('hex'),
      10,
    );
    const [, request] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          active: false,
          email: anonymizedEmail,
          user: 'Usuario dado de baja',
          password: unreachablePassword,
        },
      }),
      this.prisma.dataSubjectRequest.update({
        where: { id: requestId },
        data: {
          status: 'completada',
          resolvedAt: new Date(),
          detail: DETAIL_BY_TYPE.supresion,
        },
      }),
    ]);
    this.logger.info(`Usuario ${userId} anonimizado (solicitud #${requestId})`);
    return request;
  }

  /** Suma de días hábiles (lun-vie) para el SLA de respuesta. */
  private addBusinessDays(from: Date, days: number): Date {
    const result = new Date(from);
    let remaining = days;
    while (remaining > 0) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      if (day !== 0 && day !== 6) {
        remaining -= 1;
      }
    }
    return result;
  }
}
