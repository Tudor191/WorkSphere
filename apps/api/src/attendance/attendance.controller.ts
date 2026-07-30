import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuditLogEntity } from '../common/decorators/audit-log.decorator';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';

@ApiTags('attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @RequirePermission('attendance:create')
  @AuditLogEntity('AttendanceRecord')
  @ApiOperation({ summary: 'Check-in (pontaj), cu geolocație opțională' })
  checkIn(@Body() dto: CheckInDto) {
    return this.attendanceService.checkIn(dto);
  }

  @Post('check-out')
  @RequirePermission('attendance:create')
  @AuditLogEntity('AttendanceRecord')
  @ApiOperation({ summary: 'Check-out (pontaj) — calculează ore lucrate și suplimentare' })
  checkOut(@Body() dto: CheckOutDto) {
    return this.attendanceService.checkOut(dto);
  }

  @Get('mine')
  @RequirePermission('attendance:read')
  @ApiOperation({ summary: 'Istoricul propriu de pontaj' })
  findMine() {
    return this.attendanceService.findMine();
  }

  @Get()
  @RequirePermission('attendance:read')
  @ApiOperation({ summary: 'Istoricul de pontaj — toată compania' })
  findAll() {
    return this.attendanceService.findAll();
  }

  @Get('report/monthly')
  @RequirePermission('attendance:manage')
  @ApiOperation({ summary: 'Raport lunar agregat per angajat' })
  monthlyReport(@Query('year') year: string, @Query('month') month: string) {
    return this.attendanceService.monthlyReport(Number(year), Number(month));
  }
}
