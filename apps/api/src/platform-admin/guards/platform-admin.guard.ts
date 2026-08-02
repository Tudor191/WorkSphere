import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PlatformAdminJwtPayload } from '../../auth/types/jwt-payload.type';

/**
 * Toate rutele `PlatformAdminController` sunt `@Public()` (scapă de
 * `JwtAuthGuard`/`JwtStrategy` global, care presupun un payload de tenant),
 * deci acest guard e singura verificare de autentificare pentru ele —
 * complet separat de auth-ul obișnuit al angajaților unei companii.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Lipsește token-ul de autentificare.');
    }

    try {
      const payload = this.jwt.verify<PlatformAdminJwtPayload>(header.slice('Bearer '.length));
      if (payload.type !== 'platform_admin') {
        throw new UnauthorizedException('Token invalid pentru acest cont.');
      }
      (request as Request & { platformAdmin: { id: string; email: string } }).platformAdmin = {
        id: payload.sub,
        email: payload.email,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Sesiune invalidă sau expirată.');
    }
  }
}
