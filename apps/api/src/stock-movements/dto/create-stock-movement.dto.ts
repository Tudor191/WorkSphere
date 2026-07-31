import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export enum StockMovementTypeDto {
  IN = 'IN',
  OUT = 'OUT',
}

export class CreateStockMovementDto {
  @ApiProperty({ description: 'ID-ul produsului' })
  @IsString()
  productId!: string;

  @ApiProperty({ enum: StockMovementTypeDto })
  @IsEnum(StockMovementTypeDto)
  type!: StockMovementTypeDto;

  @ApiProperty({ example: 10, description: 'Cantitate (întotdeauna pozitivă — sensul e dat de `type`)' })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional({ example: 'Recepție marfă de la furnizor' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
