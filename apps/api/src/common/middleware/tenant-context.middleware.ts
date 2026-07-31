import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { TenantContext } from '../tenant/tenant-context';
import { JwtAccessPayload, PlatformAdminJwtPayload } from '../../auth/types/jwt-payload.type';

function isPlatformAdminPayload(
  payload: JwtAccessPayload | PlatformAdminJwtPayload,
): payload is PlatformAdminJwtPayload {
  return (payload as PlatformAdminJwtPayload).type === 'platform_admin';
}

/**
 * Populează `TenantContext` (AsyncLocalStorage) ÎNAINTE de faza de guard-uri
 * a Nest — obligatoriu ca middleware Express, nu interceptor, pentru că
 * `PermissionsGuard` are nevoie de `companyId` la rândul lui (pentru
 * interogări RLS-protejate), iar guard-urile rulează înaintea
 * interceptoarelor în ciclul de viață Nest. Verifică tot tokenul (nu doar
 * decode) — dacă e invalid, cererea continuă fără context de tenant, iar
 * `JwtAuthGuard` (care rulează după, tot din faza de guard-uri) respinge
 * cererea înainte ca vreun cod de business să ruleze.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const token = this.extractToken(req);
    if (!token) {
      return next();
    }

    try {
      const payload = this.jwtService.verify<JwtAccessPayload | PlatformAdminJwtPayload>(token);
      if (isPlatformAdminPayload(payload)) {
        // Token de admin de platformă — nu aparține niciunei companii, deci
        // nu există context de tenant de stabilit. `PlatformAdminGuard`
        // verifică acest token separat, pe rutele lui proprii.
        return next();
      }
      TenantContext.run(
        {
          companyId: payload.companyId,
          userId: payload.sub,
          roleId: payload.roleId,
          isPlatformBypass: false,
        },
        () => next(),
      );
    } catch {
      // Token invalid/expirat — JwtAuthGuard îl va respinge ulterior.
      next();
    }
  }

  private extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length);
  }
}
