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
  Req,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserCreateDto, UpdateUserDto } from './dto/user.dto';
import { UpdateProfileDto, UpdateCompanyDto } from './dto/profile.dto';
import { AuthUserPayload } from '../auth/auth-user.interface';
import { buildAuthPayload } from '../auth/auth.util';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  findAll(@Req() req: Request & { user: AuthUserPayload }) {
    this.logger.info('Starting UsersController find all');
    return this.usersService.findAllUsers(req.user?.companyId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Get('email/:email')
  findByEmail(@Param('email') email: string) {
    this.logger.info('Starting UsersController find By Email');
    return this.usersService.findByEmail(email);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Get(':id')
  findOne(
    @Param('id') id: number,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting UsersController find By ID');
    return this.usersService.findById(id, req.user?.companyId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  createUser(
    @Body() data: UserCreateDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting UsersController Create User');
    return this.usersService.createUser({
      user: data.user,
      email: data.email,
      password: data.password,
      role: data.role,
      companyId: req.user?.companyId,
    });
  }

  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Patch('me')
  async updateProfile(
    @Body() data: UpdateProfileDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting UsersController update own profile');
    const user = await this.usersService.updateProfile(
      req.user.sub,
      {
        name: data.name,
        email: data.email,
        newPassword: data.newPassword,
      },
      data.currentPassword,
      req.user.companyId,
    );
    return {
      access_token: await this.jwtService.signAsync(buildAuthPayload(user)),
    };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Patch('me/company')
  async updateMyCompany(
    @Body() data: UpdateCompanyDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting UsersController update own company');
    const user = await this.usersService.updateCompany(
      req.user.sub,
      data,
      req.user.companyId,
    );
    return {
      access_token: await this.jwtService.signAsync(buildAuthPayload(user)),
    };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  updateUser(
    @Param('id') id: number,
    @Body() data: UpdateUserDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting UsersController Update User');
    return this.usersService.updateUser(
      req.user.sub,
      id,
      {
        user: data.user,
        email: data.email,
        role: data.role,
        password: data.password,
      },
      req.user?.companyId,
    );
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  async deleteUser(
    @Param('id') id: number,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting UsersController Delete User');
    await this.usersService.deleteUser(req.user.sub, id, req.user?.companyId);
    return { message: 'Usuario eliminado correctamente' };
  }
}
