import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty()
  @IsString()
  fcmToken!: string;

  @ApiProperty({ example: 'web' })
  @IsString()
  @MaxLength(20)
  platform!: string;
}
