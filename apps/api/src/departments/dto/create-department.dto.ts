import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Vânzări' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() managerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() parentDepartmentId?: string;
}
