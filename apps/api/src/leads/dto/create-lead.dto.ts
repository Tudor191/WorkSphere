import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export enum LeadStatusDto {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  PROPOSAL = 'PROPOSAL',
  WON = 'WON',
  LOST = 'LOST',
}

export class CreateLeadDto {
  @ApiProperty({ example: 'Ion Popescu' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) companyName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) source?: string;

  @ApiPropertyOptional({ enum: LeadStatusDto, default: LeadStatusDto.NEW })
  @IsOptional()
  @IsEnum(LeadStatusDto)
  status?: LeadStatusDto;

  @ApiPropertyOptional({ description: 'Valoare estimată, în bani (RON) x100' })
  @IsOptional()
  @IsInt()
  @Min(0)
  valueCents?: number;

  @ApiPropertyOptional({ description: 'ID-ul utilizatorului responsabil de lead (opțional)' })
  @IsOptional()
  @IsString()
  ownerId?: string;
}
