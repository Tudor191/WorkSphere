import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  companyId: string;
  roleId: string;
  email: string;
}

/** Extrage utilizatorul curent (populat de `JwtStrategy`) în handler-ul controller-ului. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
