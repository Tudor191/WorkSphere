import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SetPasswordDto {
  @ApiProperty({ example: 'ParolaMeaNoua123!' })
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Parola trebuie să conțină literă mică, literă mare și cifră.',
  })
  newPassword!: string;
}
