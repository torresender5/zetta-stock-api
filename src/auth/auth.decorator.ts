import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBasicAuth, ApiBearerAuth } from '@nestjs/swagger';
import { AnyAuthGuard } from './any-auth.guard';

/**
 * Protege el endpoint aceptando JWT o Basic Auth (UserAdmin).
 */
export const Auth = () =>
    applyDecorators(UseGuards(AnyAuthGuard), ApiBearerAuth(), ApiBasicAuth());
