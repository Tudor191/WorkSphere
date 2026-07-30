import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RolesService } from './roles.service';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission('employees:read')
  @ApiOperation({ summary: 'Listă roluri disponibile în companie (pentru atribuire la angajați)' })
  findAll() {
    return this.rolesService.findAll();
  }
}
