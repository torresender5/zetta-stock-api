import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import type { Request } from 'express';
import { Auth } from '../auth/auth.decorator';
import { AuthUserPayload } from '../auth/auth-user.interface';
import { ConsentMeta } from '../users/interface/user.interface';
import { DataSubjectService } from './data-subject.service';
import { CreateDataSubjectRequestDto } from './dto/data-subject.dto';

type RequestWithUser = Request & { user?: AuthUserPayload };

/**
 * Los derechos ARCO son personales: exigen la sesión del titular (JWT).
 * El superadmin entra por Basic Auth y no tiene cuenta de usuario propia.
 */
function resolveUserId(user?: AuthUserPayload): number {
  if (!user || user.role === undefined || typeof user.sub !== 'number') {
    throw new ForbiddenException(
      'Este endpoint requiere la sesión de un usuario de la cuenta (JWT).',
    );
  }
  return user.sub;
}

function consentMeta(req: RequestWithUser): ConsentMeta {
  return {
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@ApiTags('Derechos ARCO')
@Controller()
export class DataSubjectController {
  constructor(
    private readonly dataSubjectService: DataSubjectService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Auth()
  @ApiOperation({
    summary: 'Exporta los datos personales del titular (derecho de acceso)',
  })
  @Get('users/me/export')
  exportMyData(@Req() req: RequestWithUser) {
    this.logger.info('Starting DataSubjectController export');
    return this.dataSubjectService.exportUserData(resolveUserId(req.user));
  }

  @Auth()
  @ApiOperation({ summary: 'Historial de solicitudes ARCO del titular' })
  @Get('data-subject-request')
  listMyRequests(@Req() req: RequestWithUser) {
    this.logger.info('Starting DataSubjectController list requests');
    return this.dataSubjectService.listRequests(resolveUserId(req.user));
  }

  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Registra una solicitud ARCO (acceso, rectificación, supresión o revocación)',
  })
  @Post('data-subject-request')
  createRequest(
    @Body() data: CreateDataSubjectRequestDto,
    @Req() req: RequestWithUser,
  ) {
    this.logger.info('Starting DataSubjectController create request');
    return this.dataSubjectService.createRequest(
      resolveUserId(req.user),
      data,
      consentMeta(req),
    );
  }
}
