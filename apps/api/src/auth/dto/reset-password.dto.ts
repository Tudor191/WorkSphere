import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token primit prin email la /auth/forgot-password' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'ParolaMeaNoua123!' })
  @IsString()
  @MinLength(10)
  @MaxLength(72) // bcrypt ignoră silențios ce depășește 72 de bytes
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Parola trebuie să conțină literă mică, literă mare și cifră.',
  })
  newPassword!: string;
}
