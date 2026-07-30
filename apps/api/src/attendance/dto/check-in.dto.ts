import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional } from 'class-validator';

export class CheckInDto {
  @ApiPropertyOptional({ description: 'Geolocație opțională' })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  lng?: number;
}
