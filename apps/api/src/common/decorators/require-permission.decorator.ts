import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * Declară permisiunea necesară pentru un endpoint, în formatul folosit de
 * catalogul global `Permission` (resource:action), ex:
 * `@RequirePermission('employees:delete')`.
 */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);
