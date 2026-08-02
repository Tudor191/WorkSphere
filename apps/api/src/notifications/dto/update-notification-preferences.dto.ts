import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({
    description: 'Activează/dezactivează notificările (in-app + push) la mesaje noi de chat',
  })
  @IsOptional()
  @IsBoolean()
  chatNotificationsEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Activează/dezactivează notificările prin SMS (necesită și un număr de telefon setat în profil)',
  })
  @IsOptional()
  @IsBoolean()
  smsNotificationsEnabled?: boolean;
}
