import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum ContractTypeDto {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACTOR = 'CONTRACTOR',
  INTERN = 'INTERN',
}

export class CreateEmployeeDto {
  @ApiProperty({ example: 'ana@acme.ro' })
  @IsEmail()
  email!: string;

  @ApiProperty() @IsString() @MaxLength(60) firstName!: string;
  @ApiProperty() @IsString() @MaxLength(60) lastName!: string;

  @ApiProperty({ description: 'ID-ul rolului (din /roles)' })
  @IsString()
  roleId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() departmentId?: string;

  @ApiProperty({ example: 'Consultant vânzări' })
  @IsString()
  @MaxLength(120)
  position!: string;

  @ApiProperty({ enum: ContractTypeDto, default: ContractTypeDto.FULL_TIME })
  @IsEnum(ContractTypeDto)
  contractType!: ContractTypeDto;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  hireDate!: string;

  @ApiPropertyOptional({ default: 21 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  annualLeaveDays?: number;
}
