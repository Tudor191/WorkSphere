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
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('departments')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermission('employees:read')
  @ApiOperation({ summary: 'Listă departamente' })
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  @RequirePermission('employees:read')
  @ApiOperation({ summary: 'Detalii departament' })
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @Post()
  @RequirePermission('departments:manage')
  @AuditLogEntity('Department')
  @ApiOperation({ summary: 'Creează departament' })
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('departments:manage')
  @AuditLogEntity('Department')
  @ApiOperation({ summary: 'Editează departament' })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('departments:manage')
  @AuditLogEntity('Department')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge departament' })
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }
}
