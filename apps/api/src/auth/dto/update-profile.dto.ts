import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Andrei' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Popescu' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional({ example: 'andrei@acme.ro' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+40712345678',
    description: 'Format internațional (E.164), necesar pentru SMS (Twilio)',
  })
  @IsOptional()
  @IsPhoneNumber(undefined, {
    message: 'Numărul de telefon trebuie să fie în format internațional, ex. +40712345678',
  })
  phone?: string;
}
