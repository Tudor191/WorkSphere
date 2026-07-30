import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Acme SRL' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;

  @ApiProperty({ example: 'Andrei' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty({ example: 'Popescu' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;

  @ApiProperty({ example: 'andrei@acme.ro' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ParolaMea123!' })
  @IsString()
  @MinLength(10)
  @MaxLength(72) // bcrypt ignoră silențios ce depășește 72 de bytes
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Parola trebuie să conțină literă mică, literă mare și cifră.',
  })
  password!: string;
}
