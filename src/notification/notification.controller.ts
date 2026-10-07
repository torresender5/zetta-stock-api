import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Auth } from 'src/auth/auth.decorator';
import { AuthUserPayload } from 'src/auth/auth-user.interface';
import { NotificationService } from './notification.service';
import { ListNotificationsQueryDto } from './dto/list-notifications.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notifications: NotificationService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Auth()
  @Get()
  list(
    @Query() query: ListNotificationsQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting NotificationController list');
    return this.notifications.list(req.user?.companyId, {
      page: query.page,
      limit: query.limit,
      unread: query.unread,
    });
  }

  @Auth()
  @HttpCode(HttpStatus.OK)
  @Patch('read-all')
  markAllRead(@Req() req: Request & { user: AuthUserPayload }) {
    this.logger.info('Starting NotificationController mark all read');
    return this.notifications.markAllRead(req.user?.companyId);
  }

  @Auth()
  @HttpCode(HttpStatus.OK)
  @Patch(':id/read')
  markRead(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info(`Starting NotificationController mark read: ${id}`);
    return this.notifications.markRead(id, req.user?.companyId);
  }
}
