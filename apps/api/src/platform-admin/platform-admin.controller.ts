import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminLoginDto } from './dto/platform-admin-login.dto';
import { HardResetDto } from './dto/hard-reset.dto';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import {
  CurrentPlatformAdmin,
  AuthenticatedPlatformAdmin,
} from './decorators/current-platform-admin.decorator';

/**
 * Rute complet separate de `/auth` — un `PlatformAdmin` nu e un `User` de
 * companie (vezi `schema.prisma`), deci nu trece prin `JwtAuthGuard`/
 * `JwtStrategy` obișnuiți. Controller-ul e `@Public()` la nivel de clasă
 * (scapă de guard-ul global de tenant), iar `PlatformAdminGuard` e aplicat
 * explicit pe fiecare rută protejată.
 */
@ApiTags('platform-admin')
@Public()
@Controller('platform-admin')
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autentificare cont de developer/platformă (separat de conturile de companie)',
  })
  login(@Body() dto: PlatformAdminLoginDto) {
    return this.platformAdminService.login(dto);
  }

  @Get('me')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Profilul admin-ului de platformă autentificat curent' })
  me(@CurrentPlatformAdmin() admin: AuthenticatedPlatformAdmin) {
    return this.platformAdminService.getProfile(admin.id);
  }

  @Get('companies')
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Listează toate companiile înregistrate pe platformă' })
  listCompanies() {
    return this.platformAdminService.listCompanies();
  }

  @Post('hard-reset')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({
    summary: 'Șterge ireversibil toate companiile și toate datele lor de pe platformă',
  })
  hardReset(@CurrentPlatformAdmin() admin: AuthenticatedPlatformAdmin, @Body() dto: HardResetDto) {
    return this.platformAdminService.hardReset(admin.id, admin.email, dto.confirmationPhrase);
  }

  @Delete('companies/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Șterge ireversibil o singură companie și toate datele ei' })
  deleteCompany(
    @CurrentPlatformAdmin() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
  ) {
    return this.platformAdminService.deleteCompany(admin.id, admin.email, id);
  }
}
