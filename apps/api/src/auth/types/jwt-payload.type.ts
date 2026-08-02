export interface JwtAccessPayload {
  sub: string;
  companyId: string;
  roleId: string;
  email: string;
}

/**
 * Payload al unui token emis pentru `PlatformAdmin` — complet distinct de
 * `JwtAccessPayload` (nu are `companyId`/`roleId`, un admin de platformă nu
 * aparține niciunei companii). Discriminat prin `type`, verificat explicit
 * de `PlatformAdminGuard` — un token de tenant nu poate fi refolosit pe
 * rutele de platformă doar pentru că e semnat cu același secret.
 */
export interface PlatformAdminJwtPayload {
  sub: string;
  email: string;
  type: 'platform_admin';
}

/**
 * Payload al tokenului temporar emis când cineva se autentifică prin Google
 * cu un email fără niciun cont existent — lipsește doar numele companiei
 * (Google nu-l poate furniza), deci nu putem crea compania direct în
 * callback-ul OAuth. Semnat cu un secret DERIVAT, diferit de
 * `app.jwt.accessSecret` (vezi `AuthService.googleSignupSecret`) — separare
 * criptografică deliberată, nu doar discriminare prin câmpul `purpose`:
 * acest token trebuie să fie complet inert dacă ajunge din greșeală într-un
 * header `Authorization` (spre deosebire de `PlatformAdminJwtPayload`, care
 * merge pe același secret dar nu are cum să ajungă acolo prin design — vezi
 * `PlatformAdminGuard`). Trimis STRICT în body-ul cererii, nu ca Bearer.
 */
export interface GoogleSignupPendingPayload {
  purpose: 'google_signup';
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}
