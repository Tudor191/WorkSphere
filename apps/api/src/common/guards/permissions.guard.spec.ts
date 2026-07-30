import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

function buildContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const user = { userId: 'u1', companyId: 'c1', roleId: 'r1', email: 'a@b.ro' };

  it('permite accesul dacă endpoint-ul nu declară @RequirePermission', async () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector, {} as never, {} as never);
    await expect(guard.canActivate(buildContext(user))).resolves.toBe(true);
  });

  it('permite accesul dacă rolul are permisiunea cerută', async () => {
    const reflector = { getAllAndOverride: () => 'employees:delete' } as unknown as Reflector;
    const redis = { getJson: async () => ['employees:delete', 'employees:read'] } as never;
    const prisma = { tenantScoped: { rolePermission: { findMany: jest.fn() } } } as never;
    const guard = new PermissionsGuard(reflector, prisma, redis);
    await expect(guard.canActivate(buildContext(user))).resolves.toBe(true);
  });

  it('respinge accesul dacă rolul nu are permisiunea cerută', async () => {
    const reflector = { getAllAndOverride: () => 'employees:delete' } as unknown as Reflector;
    const redis = { getJson: async () => ['employees:read'] } as never;
    const prisma = { tenantScoped: { rolePermission: { findMany: jest.fn() } } } as never;
    const guard = new PermissionsGuard(reflector, prisma, redis);
    await expect(guard.canActivate(buildContext(user))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('respinge accesul dacă nu există utilizator autentificat', async () => {
    const reflector = { getAllAndOverride: () => 'employees:delete' } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector, {} as never, {} as never);
    await expect(guard.canActivate(buildContext(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
