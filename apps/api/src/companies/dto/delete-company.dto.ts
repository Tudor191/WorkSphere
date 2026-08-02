import { IsOptional, IsString } from 'class-validator';

/**
 * `password` e opțional — la fel ca `DeleteAccountDto` (ștergere cont
 * propriu), un Admin al cărui cont a fost creat exclusiv prin Google nu are
 * o parolă de confirmat. `CompaniesService.deleteCurrent` cere parola STRICT
 * dacă adminul care cere ștergerea are `passwordHash` setat.
 */
export class DeleteCompanyDto {
  @IsOptional()
  @IsString()
  password?: string;
}
