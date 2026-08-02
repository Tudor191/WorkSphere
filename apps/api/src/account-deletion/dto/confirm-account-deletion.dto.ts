import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ConfirmAccountDeletionDto {
  @ApiProperty({ example: 'andrei@acme.ro' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  code!: string;

  @ApiProperty({ example: 'ParolaMea123!' })
  @IsString()
  password!: string;
}
