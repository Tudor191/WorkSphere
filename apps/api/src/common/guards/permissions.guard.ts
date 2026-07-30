import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

const ROLE_PERMISSIONS_CACHE_TTL_SECONDS = 60;

/**
 * Verifică `@RequirePermission('resource:action')` față de permisiunile
 * atribuite rolului utilizatorului curent. Rulează DUPĂ `JwtAuthGuard`
 * (înregistrat după el în `app.module.ts`), deci `request.user` există deja.
 *
 * Interogarea e după `roleId` (o singură valoare exactă, nu o listă
 * filtrată doar după companie), deci e sigură fără context RLS explicit —
 * un rol aparține unei singure companii prin design (FK), nu poate exista
 * ambiguitate cross-tenant.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('Utilizator neautentificat.');
    }

    const permissions = await this.getRolePermissions(user.roleId);
    if (!permissions.includes(requiredPermission)) {
      throw new ForbiddenException(
        `Rolul curent nu are permisiunea necesară: ${requiredPermission}.`,
      );
    }
    return true;
  }

  private async getRolePermissions(roleId: string): Promise<string[]> {
    const cacheKey = `role-permissions:${roleId}`;
    const cached = await this.redis.getJson<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const rolePermissions = await this.prisma.tenantScoped.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    const permissions = rolePermissions.map(
      (rp) => `${rp.permission.resource}:${rp.permission.action}`,
    );

    await this.redis.setJson(cacheKey, permissions, ROLE_PERMISSIONS_CACHE_TTL_SECONDS);
    return permissions;
  }
}
