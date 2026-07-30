import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_ENTITY_KEY = 'auditLogEntity';

/**
 * Marchează un endpoint de mutație pentru înregistrare automată în
 * `AuditLog` de către `AuditLogInterceptor`, ex: `@AuditLogEntity('Employee')`.
 */
export const AuditLogEntity = (entityType: string) => SetMetadata(AUDIT_LOG_ENTITY_KEY, entityType);
