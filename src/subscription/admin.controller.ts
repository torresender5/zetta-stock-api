import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { SubscriptionService } from './subscription.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

const AdminGuard = [AnyAuthGuard, SuperAdminGuard];

@ApiTags('Administración de suscripciones')
@ApiBearerAuth()
@ApiBasicAuth()
@Controller('admin')
export class AdminSubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ------------------------- Planes -------------------------
  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'Todos los planes (incluye inactivos)' })
  @Get('plans')
  findAllPlans() {
    return this.subscriptionService.findAllPlans();
  }

  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'Crear plan' })
  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.subscriptionService.createPlan(dto);
  }

  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'Actualizar plan' })
  @Patch('plans/:id')
  updatePlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.subscriptionService.updatePlan(id, dto);
  }

  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'Eliminar plan (no elimina el gratuito)' })
  @Delete('plans/:id')
  removePlan(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionService.removePlan(id);
  }

  // --------------------- Suscripciones ---------------------
  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'Listado de suscripciones de todas las empresas' })
  @Get('subscriptions')
  listSubscriptions() {
    return this.subscriptionService.listSubscriptions();
  }

  // --------------------- Órdenes de pago ---------------------
  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'Listado de órdenes de pago' })
  @Get('payment-orders')
  listPaymentOrders() {
    return this.subscriptionService.listPaymentOrders();
  }

  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'Confirmar pago de una orden y activar el plan' })
  @Post('payment-orders/:id/confirm')
  confirmOrder(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionService.confirmPaymentOrder(id);
  }

  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'Rechazar una orden de pago pendiente' })
  @Post('payment-orders/:id/reject')
  rejectOrder(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionService.rejectPaymentOrder(id);
  }
}
