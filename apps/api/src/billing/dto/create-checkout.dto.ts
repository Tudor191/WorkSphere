import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({ example: 'basic' })
  @IsString()
  planSlug!: string;

  @ApiPropertyOptional({ enum: ['MONTHLY', 'YEARLY'], default: 'MONTHLY' })
  @IsOptional()
  @IsIn(['MONTHLY', 'YEARLY'])
  billingCycle?: 'MONTHLY' | 'YEARLY';
}
