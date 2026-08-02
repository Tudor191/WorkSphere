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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequirePermission('clients:manage')
  @ApiOperation({ summary: 'Listă clienți' })
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  @RequirePermission('clients:manage')
  @ApiOperation({ summary: 'Detalii client' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Post()
  @RequirePermission('clients:manage')
  @AuditLogEntity('Client')
  @ApiOperation({ summary: 'Creează client' })
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('clients:manage')
  @AuditLogEntity('Client')
  @ApiOperation({ summary: 'Editează client' })
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('clients:manage')
  @AuditLogEntity('Client')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge client (doar dacă nu are task-uri/proiecte asociate)' })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
