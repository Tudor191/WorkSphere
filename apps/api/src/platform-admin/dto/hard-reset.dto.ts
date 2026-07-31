import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class HardResetDto {
  @ApiProperty({
    description:
      'Fraza de confirmare, tastată manual — un „type to confirm”, nu un secret criptografic. Protecția reală e PlatformAdminGuard.',
    example: 'imiplacepuiul',
  })
  @IsString()
  confirmationPhrase!: string;
}
