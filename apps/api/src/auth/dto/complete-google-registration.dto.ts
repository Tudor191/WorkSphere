import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CompleteGoogleRegistrationDto {
  @ApiProperty({ description: 'Token temporar primit la redirect-ul de pe /auth/google/callback' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'Acme SRL' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;
}
