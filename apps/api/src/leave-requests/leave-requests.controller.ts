import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuditLogEntity } from '../common/decorators/audit-log.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';

@ApiTags('leave-requests')
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Get()
  @RequirePermission('leave_requests:read_all')
  @ApiOperation({ summary: 'Listă cereri de concediu (toată compania)' })
  findAll() {
    return this.leaveRequestsService.findAll();
  }

  @Get('mine')
  @RequirePermission('leave_requests:read')
  @ApiOperation({ summary: 'Cererile de concediu proprii' })
  findMine() {
    return this.leaveRequestsService.findMine();
  }

  @Get('balances/mine')
  @RequirePermission('leave_requests:read')
  @ApiOperation({ summary: 'Soldul propriu de concediu pe anul curent' })
  getMyBalances() {
    return this.leaveRequestsService.getMyBalances();
  }

  @Get('types')
  @RequirePermission('leave_requests:create')
  @ApiOperation({ summary: 'Tipurile de concediu ale companiei (pentru formularul de cerere)' })
  getLeaveTypes() {
    return this.leaveRequestsService.getLeaveTypes();
  }

  @Get('balances/:employeeId')
  @RequirePermission('employees:read')
  @ApiOperation({ summary: 'Soldul de concediu al unui angajat (ex: "câte zile mai are Andrei")' })
  getBalances(@Param('employeeId') employeeId: string) {
    return this.leaveRequestsService.getBalances(employeeId);
  }

  @Post()
  @RequirePermission('leave_requests:create')
  @AuditLogEntity('LeaveRequest')
  @ApiOperation({ summary: 'Creează cerere de concediu' })
  create(@Body() dto: CreateLeaveRequestDto) {
    return this.leaveRequestsService.create(dto);
  }

  @Post(':id/approve')
  @RequirePermission('leave_requests:approve')
  @AuditLogEntity('LeaveRequest')
  @ApiOperation({ summary: 'Aprobă cerere de concediu' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveRequestsService.approve(id, user.userId);
  }

  @Post(':id/reject')
  @RequirePermission('leave_requests:approve')
  @AuditLogEntity('LeaveRequest')
  @ApiOperation({ summary: 'Respinge cerere de concediu' })
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectLeaveRequestDto,
  ) {
    return this.leaveRequestsService.reject(id, user.userId, dto);
  }

  @Post(':id/cancel')
  @RequirePermission('leave_requests:create')
  @AuditLogEntity('LeaveRequest')
  @ApiOperation({ summary: 'Anulează propria cerere de concediu (doar dacă e în așteptare)' })
  cancel(@Param('id') id: string) {
    return this.leaveRequestsService.cancel(id);
  }
}
