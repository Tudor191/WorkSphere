import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermission('notifications:read')
  @ApiOperation({ summary: 'Ultimele 50 de notificări proprii' })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.findMine(user.userId);
  }

  @Get('unread-count')
  @RequirePermission('notifications:read')
  @ApiOperation({ summary: 'Număr de notificări necitite' })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.unreadCount(user.userId);
  }

  @Patch(':id/read')
  @RequirePermission('notifications:read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marchează o notificare ca citită' })
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markRead(id, user.userId);
  }

  @Post('read-all')
  @RequirePermission('notifications:read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marchează toate notificările proprii ca citite' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.userId);
  }

  @Post('device-tokens')
  @RequirePermission('notifications:read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Înregistrează un device token (FCM) pentru push, pentru userul curent' })
  registerDeviceToken(@Body() dto: RegisterDeviceTokenDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.registerDeviceToken(user.userId, dto);
  }

  @Delete('device-tokens/:fcmToken')
  @RequirePermission('notifications:read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Dezînregistrează un device token (ex. la logout)' })
  unregisterDeviceToken(@Param('fcmToken') fcmToken: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.unregisterDeviceToken(user.userId, fcmToken);
  }
}
