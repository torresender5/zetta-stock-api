import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { AuthUserPayload } from '../auth/auth-user.interface';
import {
  ClientCreateDto,
  UpdateClientDto,
  ClientQueryDto,
} from './dto/client.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Controller('client')
export class ClientsController {
  constructor(
    private clientService: ClientsService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @AuthRoles('admin', 'vendedor')
  @Get()
  findAll(
    @Query() query: ClientQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting ClientsController find all');
    return this.clientService.findAll(query, req.user?.companyId);
  }

  // Lista completa (sin paginar) para dropdowns del modal de venta.
  // Debe declararse ANTES de @Get(':id') para no chocar con la ruta 'all'.
  @AuthRoles('admin', 'vendedor')
  @Get('all')
  findAllForDropdown(@Req() req: Request & { user: AuthUserPayload }) {
    this.logger.info('Starting ClientsController find all for dropdown');
    return this.clientService.findAllDropdown(req.user?.companyId);
  }

  @AuthRoles('admin', 'vendedor')
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const clientId = parseInt(id, 10);
    this.logger.info(`Starting ClientsController find By ID: ${clientId}`);
    return this.clientService.findById(clientId, req.user?.companyId);
  }

  @AuthRoles('admin', 'vendedor')
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  create(
    @Body() data: ClientCreateDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting ClientsController Create Client');
    return this.clientService.create(data, req.user?.companyId);
  }

  @AuthRoles('admin', 'vendedor')
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() data: UpdateClientDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const clientId = parseInt(id, 10);
    this.logger.info(`Starting ClientsController Update Client: ${clientId}`);
    return this.clientService.update(clientId, data, req.user?.companyId);
  }

  @AuthRoles('admin', 'vendedor')
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  delete(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const clientId = parseInt(id, 10);
    this.logger.info(`Starting ClientsController Delete Client: ${clientId}`);
    return this.clientService.delete(clientId, req.user?.companyId);
  }
}
