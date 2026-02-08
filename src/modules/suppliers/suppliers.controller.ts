import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    Query,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
    constructor(private readonly suppliersService: SuppliersService) { }

    @Post()
    create(@Request() req, @Body() createSupplierDto: CreateSupplierDto) {
        return this.suppliersService.create(req.user.tenantId, createSupplierDto);
    }

    @Get()
    findAll(
        @Request() req,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('search') search?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    ) {
        return this.suppliersService.findAll(req.user.tenantId, {
            page,
            limit,
            search,
            sortBy,
            sortOrder,
        });
    }

    @Get(':id')
    findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
        return this.suppliersService.findOne(req.user.tenantId, id);
    }

    @Patch(':id')
    update(
        @Request() req,
        @Param('id', ParseIntPipe) id: number,
        @Body() updateSupplierDto: UpdateSupplierDto,
    ) {
        return this.suppliersService.update(req.user.tenantId, id, updateSupplierDto);
    }

    @Delete(':id')
    remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
        return this.suppliersService.remove(req.user.tenantId, id);
    }

    @Get(':id/products')
    getProductsBySupplier(@Request() req, @Param('id', ParseIntPipe) id: number) {
        return this.suppliersService.getProductsBySupplier(req.user.tenantId, id);
    }
}
