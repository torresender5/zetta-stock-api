import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { SupplierService } from './supplier.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import {
  SupplierCreateDto,
  UpdateSupplierDto,
  SupplierQueryDto,
} from './dto/supplier.dto';

@Controller('suppliers')
export class SupplierController {
  constructor(
    private supplierService: SupplierService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @AuthRoles('admin', 'inventario')
  @Get()
  findAll(
    @Query() query: SupplierQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting SupplierController find all');
    return this.supplierService.findAllPaginated(query, req.user?.companyId);
  }

  // Lista completa (sin paginar) para dropdowns del modal de compra.
  // Debe declararse ANTES de @Get(':id') para no chocar con la ruta 'all'.
  @AuthRoles('admin', 'inventario')
  @Get('all')
  findAllForDropdown(@Req() req: Request & { user: AuthUserPayload }) {
    return this.supplierService.findAll(req.user?.companyId);
  }

  @AuthRoles('admin', 'inventario')
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const supplierId = parseInt(id, 10);
    this.logger.info(`Starting SupplierController find By ID: ${supplierId}`);
    return this.supplierService.findById(supplierId, req.user?.companyId);
  }

  @AuthRoles('admin', 'inventario')
  @HttpCode(HttpStatus.OK)
  @Post()
  create(
    @Body() data: SupplierCreateDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting SupplierController Create Supplier');
    return this.supplierService.create(data, req.user?.companyId);
  }

  @AuthRoles('admin', 'inventario')
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() data: UpdateSupplierDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const supplierId = parseInt(id, 10);
    this.logger.info(
      `Starting SupplierController Update Supplier: ${supplierId}`,
    );
    return this.supplierService.update(supplierId, data, req.user?.companyId);
  }

  @AuthRoles('admin', 'inventario')
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  delete(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const supplierId = parseInt(id, 10);
    this.logger.info(
      `Starting SupplierController Delete Supplier: ${supplierId}`,
    );
    return this.supplierService.delete(supplierId, req.user?.companyId);
  }
}
