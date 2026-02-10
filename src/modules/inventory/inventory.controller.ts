import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    Request,
    ParseIntPipe,
    DefaultValuePipe,
    UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
    constructor(private readonly inventoryService: InventoryService) { }

    @Post('transaction')
    createTransaction(
        @Body() createTransactionDto: CreateTransactionDto,
        @Request() req,
    ) {
        return this.inventoryService.createTransaction(
            req.user.tenantId,
            req.user.id,
            createTransactionDto,
        );
    }

    @Post('in')
    createEntry(@Body() body: { product_id: number; quantity: number; reason?: string }, @Request() req) {
        const dto: CreateTransactionDto = {
            product_id: body.product_id,
            quantity: body.quantity,
            type: TransactionType.IN,
            reason: body.reason,
        };
        return this.inventoryService.createTransaction(req.user.tenantId, req.user.id, dto);
    }

    @Post('out')
    createExit(@Body() body: { product_id: number; quantity: number; reason?: string }, @Request() req) {
        const dto: CreateTransactionDto = {
            product_id: body.product_id,
            quantity: body.quantity,
            type: TransactionType.OUT,
            reason: body.reason,
        };
        return this.inventoryService.createTransaction(req.user.tenantId, req.user.id, dto);
    }

    @Post('adjustment')
    createAdjustment(@Body() body: { product_id: number; quantity: number; reason: string }, @Request() req) {
        const dto: CreateTransactionDto = {
            product_id: body.product_id,
            quantity: body.quantity,
            type: TransactionType.ADJUSTMENT,
            reason: body.reason || 'Ajuste manual',
        };
        return this.inventoryService.createTransaction(req.user.tenantId, req.user.id, dto);
    }

    @Get('transactions')
    getAllTransactions(
        @Request() req,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('type') type?: TransactionType,
    ) {
        const safeLimit = Math.min(limit, 100);
        return this.inventoryService.getTransactionsByTenant(
            req.user.tenantId,
            page,
            safeLimit,
            type,
        );
    }

    @Get('transactions/product/:productId')
    getProductTransactions(
        @Param('productId', ParseIntPipe) productId: number,
        @Request() req,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        const safeLimit = Math.min(limit, 100);
        return this.inventoryService.getTransactionsByProduct(
            req.user.tenantId,
            productId,
            page,
            safeLimit,
        );
    }

    @Get('summary')
    getSummary(@Request() req) {
        return this.inventoryService.getInventorySummary(req.user.tenantId);
    }
}
