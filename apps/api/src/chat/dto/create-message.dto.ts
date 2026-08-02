import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'Bună dimineața, echipă!' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}
