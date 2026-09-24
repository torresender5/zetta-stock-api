import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBasicAuth,
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AnyAuthGuard } from 'src/auth/any-auth.guard';
import { SuperAdminGuard } from 'src/auth/super-admin.guard';
import { AdminService } from './admin.service';
import {
  AdminBusinessQueryDto,
  AdminListQueryDto,
  AdminStatusDto,
} from './dto/admin.dto';

const AdminGuard = [AnyAuthGuard, SuperAdminGuard];

@ApiTags('Administración global')
@ApiBearerAuth()
@ApiBasicAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'KPIs globales para el dashboard del superadmin' })
  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @UseGuards(...AdminGuard)
  @ApiOperation({
    summary: 'Listado de todas las empresas (con plan, usuarios y actividad)',
  })
  @Get('companies')
  companies(@Query() query: AdminListQueryDto) {
    return this.adminService.companies(query.search);
  }

  @UseGuards(...AdminGuard)
  @ApiOperation({
    summary: 'Detalle de una empresa (usuarios y últimas ventas)',
  })
  @Get('companies/:id')
  companyDetail(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.companyDetail(id);
  }

  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'Activar o desactivar una empresa' })
  @Patch('companies/:id/status')
  setCompanyStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminStatusDto,
  ) {
    return this.adminService.setCompanyStatus(id, dto.active);
  }

  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'Listado de todos los usuarios del sistema' })
  @Get('users')
  users(@Query() query: AdminListQueryDto) {
    return this.adminService.users(query.search);
  }

  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'Activar o desactivar un usuario' })
  @Patch('users/:id/status')
  setUserStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminStatusDto,
  ) {
    return this.adminService.setUserStatus(id, dto.active);
  }

  @UseGuards(...AdminGuard)
  @ApiOperation({
    summary: 'Consolidado de negocio global (ventas, compras, stock)',
  })
  @Get('business')
  business(@Query() query: AdminBusinessQueryDto) {
    return this.adminService.business(query.startDate, query.endDate);
  }
}
