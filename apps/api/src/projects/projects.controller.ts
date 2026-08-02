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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @RequirePermission('tasks:read')
  @ApiOperation({ summary: 'Listă proiecte' })
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @RequirePermission('tasks:read')
  @ApiOperation({ summary: 'Detalii proiect + task-urile lui' })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @RequirePermission('projects:manage')
  @AuditLogEntity('Project')
  @ApiOperation({ summary: 'Creează proiect' })
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('projects:manage')
  @AuditLogEntity('Project')
  @ApiOperation({ summary: 'Editează proiect' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('projects:manage')
  @AuditLogEntity('Project')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge proiect (doar dacă nu are task-uri asociate)' })
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
