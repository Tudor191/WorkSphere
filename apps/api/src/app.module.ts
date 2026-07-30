import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { AttendanceModule } from './attendance/attendance.module';
import { RolesModule } from './roles/roles.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    CompaniesModule,
    DepartmentsModule,
    EmployeesModule,
    LeaveRequestsModule,
    AttendanceModule,
    RolesModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ValidationPipe },
    // Ordine importantă: JwtAuthGuard (autentificare) rulează întâi,
    // PermissionsGuard (autorizare) după — vezi comentariile din fiecare.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
