import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCompanyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) cui?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() vatPayer?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) language?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) theme?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5) workingHoursStart?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5) workingHoursEnd?: string;
}
