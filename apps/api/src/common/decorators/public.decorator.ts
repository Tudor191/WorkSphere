import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marchează un endpoint ca accesibil fără JWT (login, register, health-check). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
