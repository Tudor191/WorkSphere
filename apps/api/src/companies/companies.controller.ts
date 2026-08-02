import { Body, Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuditLogEntity } from '../common/decorators/audit-log.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { DeleteCompanyDto } from './dto/delete-company.dto';

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

  @Get('me/subscription')
  @RequirePermission('billing:read')
  @ApiOperation({ summary: 'Abonamentul curent + planurile disponibile' })
  getSubscription() {
    return this.companiesService.getSubscription();
  }

  @Patch('me/subscription')
  @RequirePermission('billing:update')
  @AuditLogEntity('Subscription')
  @ApiOperation({ summary: 'Schimbă planul de abonament al companiei curente' })
  updateSubscription(@Body() dto: UpdateSubscriptionDto) {
    return this.companiesService.updateSubscription(dto);
  }

  @Post('me/reset/leave-requests')
  @RequirePermission('company:update')
  @AuditLogEntity('LeaveDataReset')
  @ApiOperation({
    summary: 'Șterge toate cererile de concediu și resetează soldurile companiei curente',
  })
  resetLeaveRequests() {
    return this.companiesService.resetLeaveData();
  }

  @Post('me/reset/attendance')
  @RequirePermission('company:update')
  @AuditLogEntity('AttendanceDataReset')
  @ApiOperation({ summary: 'Șterge toate înregistrările de pontaj ale companiei curente' })
  resetAttendance() {
    return this.companiesService.resetAttendanceData();
  }

  @Get('me/export')
  @RequirePermission('company:export')
  @ApiOperation({ summary: 'Export complet, în format JSON, al datelor companiei curente (GDPR)' })
  exportData() {
    return this.companiesService.exportData();
  }

  // Fără `@AuditLogEntity`: compania (și `audit_logs` ei, cascadă) e ștearsă
  // în cadrul acestui request — un audit log scris DUPĂ răspuns (cum
  // funcționează interceptorul) ar eșua pe FK inexistent. Vezi și
  // `PlatformAdminService.deleteCompany`, care are aceeași observație.
  @Delete('me')
  @RequirePermission('company:delete')
  @ApiOperation({ summary: 'Șterge definitiv compania curentă și toate datele ei (GDPR)' })
  deleteCurrent(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeleteCompanyDto) {
    return this.companiesService.deleteCurrent(user.userId, dto);
  }
}
