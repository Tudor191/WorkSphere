import { IsOptional, IsString } from 'class-validator';

/**
 * `password` e opțional — un cont creat exclusiv prin Google ("Continuă cu
 * Google") nu are niciodată o parolă (`passwordHash: null`), deci nu are ce
 * să confirme. `AuthService.deleteOwnAccount` cere parola STRICT dacă
 * `user.passwordHash` există.
 */
export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  password?: string;
}
