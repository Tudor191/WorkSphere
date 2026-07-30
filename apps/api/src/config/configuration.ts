export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshTtlDays: number;
  };
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  redisUrl: string;
  databaseUrl: string;
}

export default (): { app: AppConfig } => ({
  app: {
    port: parseInt(process.env.PORT ?? '3001', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-secret-change-me',
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? '30', 10),
    },
    google: {
      // passport-google-oauth20 aruncă eroare la construcție dacă
      // clientID/clientSecret lipsesc — folosim un placeholder în dev/CI
      // când nu sunt configurate, ca aplicația să pornească; endpoint-ul
      // `/auth/google` ar eșua la Google (client invalid), nu la boot.
      clientId: process.env.GOOGLE_CLIENT_ID || 'not-configured',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'not-configured',
      callbackUrl:
        process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3001/api/auth/google/callback',
    },
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    databaseUrl: process.env.DATABASE_URL ?? '',
  },
});
