import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    description: 'Activează/dezactivează notificările (in-app + push) la mesaje noi de chat',
  })
  @IsBoolean()
  chatNotificationsEnabled!: boolean;
}
