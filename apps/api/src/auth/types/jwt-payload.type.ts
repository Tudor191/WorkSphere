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
