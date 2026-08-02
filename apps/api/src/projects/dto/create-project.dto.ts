import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ProjectStatusDto {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}

export class CreateProjectDto {
  @ApiProperty({ example: 'Website nou' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @ApiPropertyOptional({ enum: ProjectStatusDto, default: ProjectStatusDto.PLANNING })
  @IsOptional()
  @IsEnum(ProjectStatusDto)
  status?: ProjectStatusDto;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}
