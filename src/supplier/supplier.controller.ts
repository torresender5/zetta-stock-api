import { Controller, Get, Post, Patch, Delete, UseGuards, HttpCode, HttpStatus, Body, Param, Inject} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { SupplierService } from './supplier.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { SupplierCreateDto, UpdateSupplierDto } from './dto/supplier.dto';

@Controller('suppliers')
export class SupplierController {
    constructor(private supplierService: SupplierService, @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}
    
    @UseGuards(AuthGuard)
    @Get()
    findAll(){
        this.logger.info('Starting SupplierController find all')
        return this.supplierService.findAll()
    }

    @UseGuards(AuthGuard)
    @Get(':id')
    findOne(@Param('id') id: string){
        const supplierId = parseInt(id, 10);
        this.logger.info(`Starting SupplierController find By ID: ${supplierId}`)
        return this.supplierService.findById(supplierId)
    }
    
    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post()
    create(@Body() data: SupplierCreateDto) {
        this.logger.info('Starting SupplierController Create Supplier')
        return this.supplierService.create(data);
    }

    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    @Patch(':id')
    update(@Param('id') id: string, @Body() data: UpdateSupplierDto) {
        const supplierId = parseInt(id, 10);
        this.logger.info(`Starting SupplierController Update Supplier: ${supplierId}`)
        return this.supplierService.update(supplierId, data);
    }

    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    @Delete(':id')
    delete(@Param('id') id: string) {
        const supplierId = parseInt(id, 10);
        this.logger.info(`Starting SupplierController Delete Supplier: ${supplierId}`)
        return this.supplierService.delete(supplierId);
    }
}
