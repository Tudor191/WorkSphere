import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty() companyId!: string;
  @ApiProperty() companySlug!: string;
  @ApiProperty() role!: string;
  @ApiProperty() mustChangePassword!: boolean;
}

export class AuthResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
}
