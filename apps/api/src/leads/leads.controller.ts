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
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @RequirePermission('leads:manage')
  @ApiOperation({ summary: 'Listă lead-uri' })
  findAll() {
    return this.leadsService.findAll();
  }

  @Get(':id')
  @RequirePermission('leads:manage')
  @ApiOperation({ summary: 'Detalii lead' })
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Post()
  @RequirePermission('leads:manage')
  @AuditLogEntity('Lead')
  @ApiOperation({ summary: 'Creează lead' })
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('leads:manage')
  @AuditLogEntity('Lead')
  @ApiOperation({ summary: 'Editează lead (inclusiv status pipeline)' })
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('leads:manage')
  @AuditLogEntity('Lead')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge lead' })
  remove(@Param('id') id: string) {
    return this.leadsService.remove(id);
  }
}
