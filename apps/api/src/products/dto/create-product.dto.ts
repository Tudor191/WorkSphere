import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Laptop Dell XPS 13' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'DELL-XPS13' })
  @IsString()
  @MaxLength(60)
  sku!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) barcode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) qrCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) category?: string;

  @ApiProperty({ description: 'Preț unitar, în bani (RON) x100', example: 450000 })
  @IsInt()
  @Min(0)
  unitPriceCents!: number;

  @ApiPropertyOptional({ default: 'RON' }) @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @ApiPropertyOptional({ default: 'buc' }) @IsOptional() @IsString() @MaxLength(20) unit?: string;

  @ApiPropertyOptional({ description: 'Prag sub care se afișează alertă de stoc scăzut' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockAlert?: number;
}
