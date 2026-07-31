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
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuditLogEntity } from '../common/decorators/audit-log.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequirePermission('tasks:read')
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: 'Listă task-uri (opțional filtrate după proiect)' })
  findAll(@Query('projectId') projectId?: string) {
    return this.tasksService.findAll(projectId);
  }

  @Get(':id')
  @RequirePermission('tasks:read')
  @ApiOperation({ summary: 'Detalii task' })
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  @RequirePermission('tasks:create')
  @AuditLogEntity('Task')
  @ApiOperation({ summary: 'Creează task' })
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.create(dto, user.userId);
  }

  @Patch(':id')
  @RequirePermission('tasks:update')
  @AuditLogEntity('Task')
  @ApiOperation({ summary: 'Editează task (status, prioritate, alocare etc.)' })
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('tasks:delete')
  @AuditLogEntity('Task')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge task' })
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
