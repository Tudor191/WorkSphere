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
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@ApiTags('employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermission('employees:read')
  @ApiOperation({ summary: 'Listă angajați' })
  findAll() {
    return this.employeesService.findAll();
  }

  @Get(':id')
  @RequirePermission('employees:read')
  @ApiOperation({ summary: 'Detalii angajat' })
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  @RequirePermission('employees:create')
  @AuditLogEntity('Employee')
  @ApiOperation({ summary: 'Adaugă angajat nou (creează cont + fișă HR)' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('employees:update')
  @AuditLogEntity('Employee')
  @ApiOperation({ summary: 'Editează angajat' })
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('employees:delete')
  @AuditLogEntity('Employee')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Demite angajat' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.remove(id, user.userId);
  }

  @Delete(':id/permanent')
  @RequirePermission('employees:hard_delete')
  @AuditLogEntity('Employee')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge definitiv un cont deja demis (ireversibil)' })
  hardDelete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.hardDelete(id, user.userId);
  }
}
