import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateChannelDto {
  @ApiProperty({ example: 'anunțuri' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Canal privat — vizibil doar membrilor invitați',
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({
    description: 'ID-uri de utilizatori invitați suplimentar (relevant doar dacă isPrivate=true)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  memberIds?: string[];
}
