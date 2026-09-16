import {
  Controller,
  Inject,
  Get,
  Post,
  Patch,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Auth } from '../auth/auth.decorator';
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

  @Auth()
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    this.logger.info('Starting ProductController find all');
    return this.productService.findAll(query);
  }
  @Auth()
  @Get(':id')
  findOne(@Param('id') id: string) {
    const productId = parseInt(id, 10);
    this.logger.info(`Starting ProductController find By ID: ${productId}`);
    return this.productService.findById(productId);
  }

  @UseGuards(AuthGuard)
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
  ) {
    this.logger.info('Starting ProductController Create Product');
    return this.productService.create(data, file);
  }

  @UseGuards(AuthGuard)
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
  ) {
    const productId = parseInt(id, 10);
    this.logger.info(`Starting ProductController Update Product: ${productId}`);
    return this.productService.update(productId, data, file);
  }

  @UseGuards(AuthGuard)
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
  ) {
    const productId = parseInt(id, 10);
    this.logger.info(
      `Starting ProductController Upload Image for Product: ${productId}`,
    );
    if (!file) {
      throw new BadRequestException('No se ha proporcionado un archivo');
    }
    return this.productService.uploadImage(productId, file);
  }

  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  delete(@Param('id') id: string) {
    const productId = parseInt(id, 10);
    this.logger.info(`Starting ProductController Delete Product: ${productId}`);
    return this.productService.delete(productId);
  }
}
