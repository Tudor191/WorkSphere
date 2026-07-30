import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_LOG_ENTITY_KEY } from '../decorators/audit-log.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

const SENSITIVE_FIELDS = ['passwordHash', 'twoFactorSecret', 'tokenHash'];
const MUTATING_METHODS_TO_ACTION: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const clone: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const field of SENSITIVE_FIELDS) delete clone[field];
  return clone;
}

/**
 * Înregistrează automat orice mutație (`@AuditLogEntity(...)`) în tabelul
 * `AuditLog`, DUPĂ ce răspunsul e trimis cu succes (nu blochează request-ul
 * — scrierea se face fire-and-forget, cu logare de eroare dacă eșuează,
 * pentru a nu compromite disponibilitatea API-ului din cauza audit log-ului).
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const entityType = this.reflector.getAllAndOverride<string | undefined>(AUDIT_LOG_ENTITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!entityType) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    const action = MUTATING_METHODS_TO_ACTION[request.method] ?? request.method;

    return next.handle().pipe(
      tap((responseBody: Record<string, unknown> | undefined) => {
        if (!user) return;
        const entityId = responseBody?.id ?? request.params?.id ?? 'unknown';
        this.prisma.tenantScoped.auditLog
          .create({
            data: {
              companyId: user.companyId,
              userId: user.userId,
              action,
              entityType,
              entityId: String(entityId),
              newValues: sanitize(responseBody) as never,
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
            },
          })
          .catch((error) => this.logger.error('Eșec scriere audit log', error));
      }),
    );
  }
}
