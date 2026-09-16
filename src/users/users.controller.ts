import {
  Controller,
  Get,
  Post,
  UseGuards,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { UserCreateDto } from './dto/user.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}
  // private readonly logger = new Logger(UsersController.name);

  @UseGuards(AuthGuard)
  @Get()
  findAll() {
    this.logger.info('Starting UsersController find all');
    return this.usersService.findAllUsers();
  }
  // @UseGuards(AuthGuard)
  @Get(':id')
  findOne(@Query('id') id: number) {
    this.logger.info('Starting UsersController find By ID');
    return this.usersService.findById(id);
  }

  @UseGuards(AuthGuard)
  @Get('email/:email')
  findByEmail(@Query('email') email: string) {
    this.logger.info('Starting UsersController find By Email');
    return this.usersService.findByEmail(email);
  }

  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('create')
  createUser(@Body() data: UserCreateDto) {
    this.logger.info('Starting UsersController Create User');
    return this.usersService.createUser(data);
  }
}

// 10262177
