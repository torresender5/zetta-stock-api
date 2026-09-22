import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';

@ApiTags('Planes')
@Controller('plans')
export class PlansController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @ApiOperation({ summary: 'Lista los planes activos (catálogo público)' })
  @Get()
  findAll() {
    return this.subscriptionService.listActivePlans();
  }
}
