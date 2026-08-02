import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuditLogEntity } from '../common/decorators/audit-log.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermission('products:manage')
  @ApiOperation({ summary: 'Listă produse' })
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @RequirePermission('products:manage')
  @ApiOperation({ summary: 'Detalii produs + ultimele mișcări de stoc' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @RequirePermission('products:manage')
  @AuditLogEntity('Product')
  @ApiOperation({
    summary: 'Creează produs (stoc inițial 0 — se adaugă printr-o mișcare de intrare)',
  })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('products:manage')
  @AuditLogEntity('Product')
  @ApiOperation({ summary: 'Editează produs' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('products:manage')
  @AuditLogEntity('Product')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge produs (doar dacă stocul e 0)' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
