import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuditLogEntity } from '../common/decorators/audit-log.decorator';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('me')
  @RequirePermission('company:read')
  @ApiOperation({ summary: 'Setările companiei curente' })
  getCurrent() {
    return this.companiesService.getCurrent();
  }

  @Patch('me')
  @RequirePermission('company:update')
  @AuditLogEntity('Company')
  @ApiOperation({ summary: 'Editează setările companiei curente' })
  update(@Body() dto: UpdateCompanyDto) {
    return this.companiesService.updateCurrent(dto);
  }
}
