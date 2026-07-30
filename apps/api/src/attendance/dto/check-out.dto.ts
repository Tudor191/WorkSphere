import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional } from 'class-validator';

export class CheckOutDto {
  @ApiPropertyOptional({ description: 'Geolocație opțională' })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  lng?: number;
}
