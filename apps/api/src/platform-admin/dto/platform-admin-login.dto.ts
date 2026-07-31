import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class PlatformAdminLoginDto {
  @ApiProperty({ example: 'dev@worksphere.ro' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ParolaMea123!' })
  @IsString()
  @MinLength(1)
  password!: string;
}
