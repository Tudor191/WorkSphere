import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateSubscriptionDto {
  @ApiProperty({ example: 'pro', description: 'Slug-ul planului dorit (trial, basic, pro).' })
  @IsString()
  planSlug!: string;
}
