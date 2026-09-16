import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  UseGuards,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { AuthGuard } from '../auth/auth.guard';
import { ClientCreateDto, UpdateClientDto } from './dto/client.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Controller('client')
export class ClientsController {
  constructor(
    private clientService: ClientsService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @UseGuards(AuthGuard)
  @Get()
  findAll() {
    this.logger.info('Starting ClientsController find all');
    return this.clientService.findAll();
  }
  @UseGuards(AuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    const clientId = parseInt(id, 10);
    this.logger.info(`Starting ClientsController find By ID: ${clientId}`);
    return this.clientService.findById(clientId);
  }

  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  create(@Body() data: ClientCreateDto) {
    this.logger.info('Starting ClientsController Create Client');
    return this.clientService.create(data);
  }

  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateClientDto) {
    const clientId = parseInt(id, 10);
    this.logger.info(`Starting ClientsController Update Client: ${clientId}`);
    return this.clientService.update(clientId, data);
  }

  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  delete(@Param('id') id: string) {
    const clientId = parseInt(id, 10);
    this.logger.info(`Starting ClientsController Delete Client: ${clientId}`);
    return this.clientService.delete(clientId);
  }
}
