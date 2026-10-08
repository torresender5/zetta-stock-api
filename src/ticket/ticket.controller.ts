import {
  BadRequestException,
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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import type { Request } from 'express';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { AuthUserPayload } from '../auth/auth-user.interface';
import { TicketService } from './ticket.service';
import {
  CompanyTicketStatusDto,
  TicketCreateDto,
  TicketMessageDto,
  TicketQueryDto,
} from './dto/ticket.dto';

type RequestWithUser = Request & { user?: AuthUserPayload };

const imageFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMimes.includes(file.mimetype)) {
    cb(
      new BadRequestException(
        'Tipo de archivo no permitido. Use JPG, PNG, WebP o GIF',
      ),
      false,
    );
  } else {
    cb(null, true);
  }
};

/** Los endpoints de empresa exigen JWT con empresa (el Basic del superadmin no aplica). */
function requireCompanyId(user?: AuthUserPayload): number {
  if (!user?.companyId) {
    throw new ForbiddenException(
      'Se requiere la sesión de un usuario de la empresa (JWT).',
    );
  }
  return user.companyId;
}

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketController {
  constructor(
    private ticketService: TicketService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @AuthRoles('admin')
  @ApiOperation({ summary: 'Tickets de la empresa (solo rol Administrador)' })
  @Get()
  findAll(@Query() query: TicketQueryDto, @Req() req: RequestWithUser) {
    this.logger.info('Starting TicketController find all');
    return this.ticketService.findAll(query, requireCompanyId(req.user));
  }

  @AuthRoles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un ticket con mensaje inicial (imagen opcional)',
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @Post('create')
  create(
    @Body() data: TicketCreateDto,
    @Req() req: RequestWithUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.logger.info('Starting TicketController create ticket');
    return this.ticketService.create(data, requireUser(req.user), file);
  }

  @AuthRoles('admin')
  @ApiOperation({ summary: 'Detalle del ticket con todo el hilo de mensajes' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    this.logger.info(`Starting TicketController find By ID: ${id}`);
    return this.ticketService.getDetail(id, requireCompanyId(req.user));
  }

  @AuthRoles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Responder un ticket desde la empresa' })
  @Post(':id/messages')
  addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: TicketMessageDto,
    @Req() req: RequestWithUser,
  ) {
    this.logger.info(`Starting TicketController add message: ${id}`);
    requireCompanyId(req.user);
    return this.ticketService.addCompanyMessage(id, data.body, req.user!);
  }

  @AuthRoles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar o reabrir un ticket de la empresa' })
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: CompanyTicketStatusDto,
    @Req() req: RequestWithUser,
  ) {
    this.logger.info(`Starting TicketController update status: ${id}`);
    return this.ticketService.updateCompanyStatus(
      id,
      data.status,
      requireCompanyId(req.user),
    );
  }
}

function requireUser(user?: AuthUserPayload): AuthUserPayload {
  if (!user?.companyId || typeof user.sub !== 'number') {
    throw new ForbiddenException(
      'Se requiere la sesión de un usuario de la empresa (JWT).',
    );
  }
  return user;
}
