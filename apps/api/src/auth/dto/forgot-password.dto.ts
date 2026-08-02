import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'andrei@acme.ro' })
  @IsEmail()
  email!: string;
}
