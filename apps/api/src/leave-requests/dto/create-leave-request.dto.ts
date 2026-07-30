import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLeaveRequestDto {
  @ApiProperty() @IsString() leaveTypeId!: string;
  @ApiProperty({ example: '2026-08-10' }) @IsDateString() startDate!: string;
  @ApiProperty({ example: '2026-08-14' }) @IsDateString() endDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
