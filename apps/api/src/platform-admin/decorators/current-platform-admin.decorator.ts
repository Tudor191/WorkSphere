import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedPlatformAdmin {
  id: string;
  email: string;
}

/** Extrage admin-ul de platformă curent (populat de `PlatformAdminGuard`). */
export const CurrentPlatformAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedPlatformAdmin => {
    const request = ctx.switchToHttp().getRequest();
    return request.platformAdmin;
  },
);
