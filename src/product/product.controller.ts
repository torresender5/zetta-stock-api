import { Controller, Inject, Get, Post, Patch, Delete, UseGuards, HttpCode, HttpStatus, Body, Param, Query, UseInterceptors, UploadedFile, BadRequestException, Req} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Auth } from '../auth/auth.decorator';
import { ProductService } from './product.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ProductCreateDto, UpdateProductDto } from './dto/product.dto';
import { PaginationQueryDto } from './dto/pagination.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

@Controller('products')
export class ProductController {
    constructor(private productService: ProductService, @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}
    
    @Auth()
    @Get()
    findAll(@Query() query: PaginationQueryDto){
        this.logger.info('Starting ProductController find all')
        return this.productService.findAll(query)
    }
    @Auth()
    @Get(':id')
    findOne(@Param('id') id: string){
        const productId = parseInt(id, 10);
        this.logger.info(`Starting ProductController find By ID: ${productId}`)
        return this.productService.findById(productId)
    }
    
    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post()
    create(@Body() data: ProductCreateDto) {
        this.logger.info('Starting ProductController Create Product')
        return this.productService.create(data);
    }

    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    @Patch(':id')
    update(@Param('id') id: string, @Body() data: UpdateProductDto) {
        const productId = parseInt(id, 10);
        this.logger.info(`Starting ProductController Update Product: ${productId}`)
        return this.productService.update(productId, data);
    }

    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    @Patch(':id/image')
    @UseInterceptors(
        FileInterceptor('image', {
            storage: diskStorage({
                destination: (_req, _file, cb) => {
                    const uploadDir = process.env.UPLOAD_DIR || './uploads/products';
                    if (!existsSync(uploadDir)) {
                        mkdirSync(uploadDir, { recursive: true });
                    }
                    cb(null, uploadDir);
                },
                filename: (_req, file, cb) => {
                    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
                    cb(null, uniqueName);
                },
            }),
            fileFilter: (_req, file, cb) => {
                const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
                if (!allowedMimes.includes(file.mimetype)) {
                    cb(new BadRequestException('Tipo de archivo no permitido. Use JPG, PNG, WebP o GIF'), false);
                } else {
                    cb(null, true);
                }
            },
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
        }),
    )
    uploadImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Req() req: any) {
        const productId = parseInt(id, 10);
        this.logger.info(`Starting ProductController Upload Image for Product: ${productId}`);
        if (!file) {
            throw new BadRequestException('No se ha proporcionado un archivo');
        }
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const imageUrl = `${baseUrl}/uploads/products/${file.filename}`;
        return this.productService.updateImage(productId, imageUrl);
    }

    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    @Delete(':id')
    delete(@Param('id') id: string) {
        const productId = parseInt(id, 10);
        this.logger.info(`Starting ProductController Delete Product: ${productId}`)
        return this.productService.delete(productId);
    }
}
