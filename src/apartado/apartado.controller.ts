import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  Body,
  Param,
  Query,
  Inject,
  Req,
} from '@nestjs/common';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { AuthUserPayload } from '../auth/auth-user.interface';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ApartadoService } from './apartado.service';
import {
  CreateApartadoDto,
  AddApartadoPaymentDto,
  CancelApartadoDto,
  CompleteApartadoDto,
  ListApartadosQueryDto,
} from './apartado.dto';

@Controller('apartados')
export class ApartadoController {
  constructor(
    private readonly apartadoService: ApartadoService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @AuthRoles('admin', 'vendedor')
  @Get()
  findAll(
    @Query() query: ListApartadosQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting ApartadoController find all');
    return this.apartadoService.findAll(
      req.user?.companyId,
      query.page ?? 1,
      query.limit ?? 10,
      query.status,
    );
  }

  @AuthRoles('admin', 'vendedor')
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const apartadoId = parseInt(id, 10);
    this.logger.info(`Starting ApartadoController find By ID: ${apartadoId}`);
    return this.apartadoService.findById(apartadoId, req.user?.companyId);
  }

  @AuthRoles('admin', 'vendedor')
  @HttpCode(HttpStatus.OK)
  @Post()
  create(
    @Body() data: CreateApartadoDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting ApartadoController create');
    return this.apartadoService.create(data, req.user?.companyId, req.user.sub);
  }

  @AuthRoles('admin', 'vendedor')
  @HttpCode(HttpStatus.OK)
  @Post(':id/payments')
  addPayment(
    @Param('id') id: string,
    @Body() data: AddApartadoPaymentDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const apartadoId = parseInt(id, 10);
    this.logger.info(`Starting ApartadoController add payment: ${apartadoId}`);
    return this.apartadoService.addPayment(
      apartadoId,
      data,
      req.user?.companyId,
      req.user.sub,
    );
  }

  @AuthRoles('admin', 'vendedor')
  @HttpCode(HttpStatus.OK)
  @Post(':id/complete')
  complete(
    @Param('id') id: string,
    @Body() data: CompleteApartadoDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const apartadoId = parseInt(id, 10);
    this.logger.info(`Starting ApartadoController complete: ${apartadoId}`);
    return this.apartadoService.complete(
      apartadoId,
      data,
      req.user?.companyId,
      req.user.sub,
    );
  }

  @AuthRoles('admin', 'vendedor')
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() data: CancelApartadoDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const apartadoId = parseInt(id, 10);
    this.logger.info(`Starting ApartadoController cancel: ${apartadoId}`);
    return this.apartadoService.cancel(
      apartadoId,
      data,
      req.user?.companyId,
      req.user.sub,
    );
  }
}
