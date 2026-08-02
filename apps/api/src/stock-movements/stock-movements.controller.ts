import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuditLogEntity } from '../common/decorators/audit-log.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { StockMovementsService } from './stock-movements.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@ApiTags('stock-movements')
@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Get()
  @RequirePermission('products:manage')
  @ApiQuery({ name: 'productId', required: false })
  @ApiOperation({ summary: 'Listă mișcări de stoc (opțional filtrate după produs)' })
  findAll(@Query('productId') productId?: string) {
    return this.stockMovementsService.findAll(productId);
  }

  @Post()
  @RequirePermission('products:manage')
  @AuditLogEntity('StockMovement')
  @ApiOperation({
    summary: 'Înregistrează o mișcare de stoc (intrare/ieșire) și actualizează stocul curent',
  })
  create(@Body() dto: CreateStockMovementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.stockMovementsService.create(dto, user.userId);
  }
}
