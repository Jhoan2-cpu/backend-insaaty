import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Request,
    Query,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Post()
    create(@Body() createProductDto: CreateProductDto, @Request() req) {
        return this.productsService.create(req.user.tenantId, createProductDto);
    }

    @Get()
    findAll(
        @Request() req,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('search') search?: string,
        @Query('stockStatus') stockStatus?: string,
    ) {
        const safeLimit = Math.min(limit, 100);
        const safePage = Math.max(page, 1);
        return this.productsService.findAllByTenant(
            req.user.tenantId,
            {
                page: safePage,
                limit: safeLimit,
                search,
                stockStatus,
            }
        );
    }

    @Get('low-stock')
    getLowStock(@Request() req) {
        return this.productsService.getLowStockProductsRaw(req.user.tenantId);
    }

    @Get('sku/:sku')
    findBySku(@Param('sku') sku: string, @Request() req) {
        return this.productsService.findBySku(sku, req.user.tenantId);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.productsService.findOne(id, req.user.tenantId);
    }

    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateProductDto: UpdateProductDto,
        @Request() req,
    ) {
        return this.productsService.update(id, req.user.tenantId, updateProductDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.productsService.remove(id, req.user.tenantId);
    }
}
