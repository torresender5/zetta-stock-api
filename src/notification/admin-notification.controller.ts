import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { NotificationService } from './notification.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { ListAnnouncementsQueryDto } from './dto/admin-announcements.dto';

const AdminGuard = [AnyAuthGuard, SuperAdminGuard];

@ApiTags('Administración global')
@ApiBearerAuth()
@ApiBasicAuth()
@Controller('admin/notifications')
export class AdminNotificationController {
  constructor(
    private readonly notifications: NotificationService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @UseGuards(...AdminGuard)
  @ApiOperation({
    summary:
      'Crea una notificación general y la asigna (fan-out por destinatario)',
  })
  @Post()
  create(@Body() dto: CreateAnnouncementDto) {
    this.logger.info('Starting AdminNotificationController create');
    return this.notifications.createAnnouncement({
      title: dto.title.trim(),
      body: dto.body?.trim() || null,
      targets: {
        kind: dto.targets.kind,
        userIds: dto.targets.userIds,
        companyIds: dto.targets.companyIds,
        role: dto.targets.role,
      },
    });
  }

  @UseGuards(...AdminGuard)
  @ApiOperation({ summary: 'Historial de notificaciones enviadas (agregado)' })
  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Query() query: ListAnnouncementsQueryDto) {
    this.logger.info('Starting AdminNotificationController list');
    return this.notifications.listAnnouncements({
      page: query.page,
      limit: query.limit,
    });
  }
}
