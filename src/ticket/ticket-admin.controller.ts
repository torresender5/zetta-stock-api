import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBasicAuth,
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AnyAuthGuard } from 'src/auth/any-auth.guard';
import { SuperAdminGuard } from 'src/auth/super-admin.guard';
import { AuthUserPayload } from 'src/auth/auth-user.interface';
import { TicketService } from './ticket.service';
import {
  AdminTicketQueryDto,
  SupportTicketStatusDto,
  TicketMessageDto,
} from './dto/ticket.dto';

const AdminGuard = [AnyAuthGuard, SuperAdminGuard];

@ApiTags('Administración global - Tickets')
@ApiBearerAuth()
@ApiBasicAuth()
@Controller('admin/tickets')
export class TicketAdminController {
  constructor(
    private readonly ticketService: TicketService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @UseGuards(...AdminGuard)
  @ApiOperation({
    summary: 'Todos los tickets por empresa (solo superadmin)',
  })
  @Get()
  findAll(@Query() query: AdminTicketQueryDto) {
    this.logger.info('Starting TicketAdminController find all');
    return this.ticketService.adminFindAll(query);
  }

  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'Detalle del ticket con su hilo de mensajes' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.info(`Starting TicketAdminController find By ID: ${id}`);
    return this.ticketService.adminGetDetail(id);
  }

  @UseGuards(...AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Responder un ticket (avisa a la empresa in-app)' })
  @Post(':id/messages')
  addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: TicketMessageDto,
    @Req() req: Request & { user?: AuthUserPayload },
  ) {
    this.logger.info(`Starting TicketAdminController add message: ${id}`);
    if (!req.user) {
      throw new ForbiddenException('Autenticación requerida');
    }
    return this.ticketService.adminAddMessage(id, data.body, req.user);
  }

  @UseGuards(...AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cambiar el estado del ticket (pendiente/en proceso/finalizado)',
  })
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: SupportTicketStatusDto,
  ) {
    this.logger.info(`Starting TicketAdminController update status: ${id}`);
    return this.ticketService.adminUpdateStatus(id, data.status);
  }
}
