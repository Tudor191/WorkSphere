import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'andrei@acme.ro' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ParolaMea123!' })
  @IsString()
  @MinLength(1)
  password!: string;
}
