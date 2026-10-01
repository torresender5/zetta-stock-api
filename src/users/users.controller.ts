import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Req,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users.service';
import { Auth } from '../auth/auth.decorator';
import { AuthRoles } from '../auth/auth-roles.decorator';
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

  @AuthRoles('admin')
  @Get()
  findAll(@Req() req: Request & { user: AuthUserPayload }) {
    this.logger.info('Starting UsersController find all');
    return this.usersService.findAllUsers(req.user?.companyId);
  }

  @AuthRoles('admin')
  @Get('email/:email')
  findByEmail(
    @Param('email') email: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting UsersController find By Email');
    return this.usersService.findSafeByEmail(email, req.user?.companyId);
  }

  @AuthRoles('admin')
  @Get(':id')
  findOne(
    @Param('id') id: number,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting UsersController find By ID');
    return this.usersService.findById(id, req.user?.companyId);
  }

  @AuthRoles('admin')
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

  @Auth()
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

  @AuthRoles('admin')
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

  @AuthRoles('admin')
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

  @AuthRoles('admin')
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
