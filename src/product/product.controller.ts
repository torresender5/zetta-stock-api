import {
  Controller,
  Inject,
  Get,
  Post,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { AuthUserPayload } from '../auth/auth-user.interface';
import { ProductService } from './product.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ProductCreateDto, UpdateProductDto } from './dto/product.dto';
import { PaginationQueryDto } from './dto/pagination.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

const imageFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMimes.includes(file.mimetype)) {
    cb(
      new BadRequestException(
        'Tipo de archivo no permitido. Use JPG, PNG, WebP o GIF',
      ),
      false,
    );
  } else {
    cb(null, true);
  }
};

@Controller('products')
export class ProductController {
  constructor(
    private productService: ProductService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @AuthRoles('admin', 'vendedor', 'inventario')
  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting ProductController find all');
    return this.productService.findAll(query, req.user?.companyId);
  }
  @AuthRoles('admin', 'vendedor', 'inventario')
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUserPayload },
  ) {
    const productId = parseInt(id, 10);
    this.logger.info(`Starting ProductController find By ID: ${productId}`);
    return this.productService.findById(productId, req.user?.companyId);
  }

  @AuthRoles('admin', 'inventario')
  @HttpCode(HttpStatus.OK)
  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  create(
    @Body() data: ProductCreateDto,
    @UploadedFile() file?: Express.Multer.File,
    @Req() req?: Request & { user: AuthUserPayload },
  ) {
    this.logger.info('Starting ProductController Create Product');
    return this.productService.create(data, file, req?.user?.companyId);
  }

  @AuthRoles('admin', 'inventario')
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  update(
    @Param('id') id: string,
    @Body() data: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
    @Req() req?: Request & { user: AuthUserPayload },
  ) {
    const productId = parseInt(id, 10);
    this.logger.info(`Starting ProductController Update Product: ${productId}`);
    return this.productService.update(
      productId,
      data,
      file,
      req?.user?.companyId,
    );
  }

  @AuthRoles('admin', 'inventario')
  @HttpCode(HttpStatus.OK)
  @Patch(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req?: Request & { user: AuthUserPayload },
  ) {
    const productId = parseInt(id, 10);
    this.logger.info(
      `Starting ProductController Upload Image for Product: ${productId}`,
    );
    if (!file) {
      throw new BadRequestException('No se ha proporcionado un archivo');
    }
    return this.productService.uploadImage(
      productId,
      file,
      req?.user?.companyId,
    );
  }

  @AuthRoles('admin', 'inventario')
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  delete(
    @Param('id') id: string,
    @Req() req?: Request & { user: AuthUserPayload },
  ) {
    const productId = parseInt(id, 10);
    this.logger.info(`Starting ProductController Delete Product: ${productId}`);
    return this.productService.delete(productId, req?.user?.companyId);
  }
}
