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
import { CashRegisterService } from './cash-register.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import {
  OpenCashRegisterDto,
  CreateCashMovementDto,
  CloseCashRegisterDto,
  ListCashRegistersQueryDto,
} from './dto/cash-register.dto';

@Controller('cash-registers')
export class CashRegisterController {
  constructor(
    private cashRegisterService: CashRegisterService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @AuthRoles('admin', 'vendedor')
  @Get('active')
  findActive(@Req() req: Request & { user: AuthUserPayload }) {
    this.logger.info('Starting CashRegisterController find active');
    return this.cashRegisterService.findActive(
      req.user.sub,
      req.user?.companyId,
    );
  }

  @AuthRoles('admin', 'vendedor')
  @Get()
  findAll(
    @Query() query: ListCashRegistersQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting CashRegisterController find all');
    return this.cashRegisterService.findAll(
      req.user?.companyId,
      query.status,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @AuthRoles('admin', 'vendedor')
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const cashRegisterId = parseInt(id, 10);
    this.logger.info(
      `Starting CashRegisterController find by ID: ${cashRegisterId}`,
    );
    return this.cashRegisterService.findById(
      cashRegisterId,
      req.user?.companyId,
    );
  }

  @AuthRoles('admin', 'vendedor')
  @Post('open')
  open(
    @Body() data: OpenCashRegisterDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting CashRegisterController open');
    return this.cashRegisterService.open(
      req.user.sub,
      data,
      req.user?.companyId,
    );
  }

  @AuthRoles('admin', 'vendedor')
  @HttpCode(HttpStatus.CREATED)
  @Post(':id/movements')
  addMovement(
    @Param('id') id: string,
    @Body() data: CreateCashMovementDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const cashRegisterId = parseInt(id, 10);
    this.logger.info(
      `Starting CashRegisterController add movement to: ${cashRegisterId}`,
    );
    return this.cashRegisterService.addMovement(
      cashRegisterId,
      data,
      req.user?.companyId,
    );
  }

  @AuthRoles('admin', 'vendedor')
  @HttpCode(HttpStatus.OK)
  @Post(':id/close')
  close(
    @Param('id') id: string,
    @Body() data: CloseCashRegisterDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const cashRegisterId = parseInt(id, 10);
    this.logger.info(
      `Starting CashRegisterController close: ${cashRegisterId}`,
    );
    return this.cashRegisterService.close(
      cashRegisterId,
      {
        cash: data.cash ?? 0,
        card: data.card ?? 0,
        transfer: data.transfer ?? 0,
        credit: data.credit ?? 0,
      },
      req.user?.companyId,
    );
  }

  @AuthRoles('admin', 'vendedor')
  @Get(':id/summary')
  getSummary(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const cashRegisterId = parseInt(id, 10);
    this.logger.info(
      `Starting CashRegisterController summary: ${cashRegisterId}`,
    );
    return this.cashRegisterService.getSummary(
      cashRegisterId,
      req.user?.companyId,
    );
  }
}
