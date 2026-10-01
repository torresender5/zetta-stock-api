import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { AuthUserPayload } from '../auth/auth-user.interface';
import { CategoryService } from './category.service';
import {
  CategoryCreateDto,
  CategoryQueryDto,
  UpdateCategoryDto,
} from './dto/category.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(
    private categoryService: CategoryService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @AuthRoles('admin', 'vendedor', 'inventario')
  @Get()
  findAll(
    @Query() query: CategoryQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting CategoryController find all');
    return this.categoryService.findAll(query, req.user?.companyId);
  }

  // Lista completa (sin paginar) para dropdowns. Debe declararse ANTES de
  // @Get(':id') para no chocar con la ruta 'all'.
  @AuthRoles('admin', 'vendedor', 'inventario')
  @Get('all')
  findAllForDropdown(@Req() req: Request & { user: AuthUserPayload }) {
    this.logger.info('Starting CategoryController find all for dropdown');
    return this.categoryService.findAllDropdown(req.user?.companyId);
  }

  @AuthRoles('admin', 'vendedor', 'inventario')
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const categoryId = parseInt(id, 10);
    this.logger.info(`Starting CategoryController find By ID: ${categoryId}`);
    return this.categoryService.findById(categoryId, req.user?.companyId);
  }

  @AuthRoles('admin', 'inventario')
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(
    @Body() data: CategoryCreateDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting CategoryController Create Category');
    return this.categoryService.create(data, req.user?.companyId);
  }

  @AuthRoles('admin', 'inventario')
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() data: UpdateCategoryDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const categoryId = parseInt(id, 10);
    this.logger.info(
      `Starting CategoryController Update Category: ${categoryId}`,
    );
    return this.categoryService.update(categoryId, data, req.user?.companyId);
  }

  @AuthRoles('admin', 'inventario')
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const categoryId = parseInt(id, 10);
    this.logger.info(
      `Starting CategoryController Delete Category: ${categoryId}`,
    );
    return this.categoryService.remove(categoryId, req.user?.companyId);
  }
}
