import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PaginationQueryDto } from './dto/pagination.dto';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class ProductService {

    constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger, private productPrisma: PrismaService) {}
    
    async findAll(query: PaginationQueryDto) {
        this.logger.info('Starting ProductService function');
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;

        const where: any = {};
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { sku: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        if (query.category) {
            where.category = query.category;
        }
        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) {
                where.createdAt.gte = new Date(query.startDate);
            }
            if (query.endDate) {
                const end = new Date(query.endDate);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        try {
            const [data, total] = await Promise.all([
                this.productPrisma.product.findMany({
                    where,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                }),
                this.productPrisma.product.count({ where }),
            ]);
            return {
                data,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.max(1, Math.ceil(total / limit)),
                },
            };
        } catch (error) {
            this.logger.error('Error finding products:', error);
            throw error;
        }
    }

    async findById(id: number) {
        this.logger.info(`Finding product by ID: ${id}`);
        try {
          const result = await this.productPrisma.product.findUnique({
            where: { 
              id
            }
          });
          return result || null;
        } catch (error) {
          this.logger.error(`Error finding product ${id}:`, error);
          throw error;
        }
    }

    async create(data: any) {
      try {
        this.logger.info('Creating product:', { name: data.name });
        const createData = {
          ...data,
          purchasePrice: Number(data.purchasePrice),
          salePrice: Number(data.salePrice),
          stock: Number(data.stock),
        };
        return await this.productPrisma.product.create({ 
          data: createData 
        });
      } catch (error) {
        this.logger.error('Error creating product:', error);
        throw error;
      }
    }

    async update(id: number, data: any) {
      try {
        this.logger.info(`Updating product: ${id}`);
        const updateData: any = { ...data };
        if (data.purchasePrice !== undefined) updateData.purchasePrice = Number(data.purchasePrice);
        if (data.salePrice !== undefined) updateData.salePrice = Number(data.salePrice);
        if (data.stock !== undefined) updateData.stock = Number(data.stock);
        return await this.productPrisma.product.update({
          where: { id },
          data: updateData,
        });
      } catch (error) {
        this.logger.error(`Error updating product ${id}:`, error);
        throw error;
      }
    }

    async updateImage(id: number, imageUrl: string) {
      try {
        this.logger.info(`Updating image for product: ${id}`);
        const product = await this.productPrisma.product.findUnique({ where: { id } });
        if (!product) {
          throw new Error('Producto no encontrado');
        }
        if (product.image) {
          this.deleteImageFile(product.image);
        }
        return await this.productPrisma.product.update({
          where: { id },
          data: { image: imageUrl },
        });
      } catch (error) {
        this.logger.error(`Error updating image for product ${id}:`, error);
        throw error;
      }
    }

    private deleteImageFile(imagePath: string) {
      try {
        const uploadDir = process.env.UPLOAD_DIR || './uploads/products';
        const filename = imagePath.split('/').pop();
        if (filename) {
          const fullPath = join(uploadDir, filename);
          if (existsSync(fullPath)) {
            unlinkSync(fullPath);
            this.logger.info(`Deleted old image: ${fullPath}`);
          }
        }
      } catch (error) {
        this.logger.error('Error deleting old image file:', error);
      }
    }

    async delete(id: number) {
      try {
        this.logger.info(`Deleting product: ${id}`);
        const product = await this.productPrisma.product.findUnique({ where: { id } });
        if (product?.image) {
          this.deleteImageFile(product.image);
        }
        return await this.productPrisma.product.delete({
          where: { id },
        });
      } catch (error) {
        this.logger.error(`Error deleting product ${id}:`, error);
        throw error;
      }
    }
}
