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
  openai: {
    apiKey: string;
    model: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
  firebase: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
  resend: {
    apiKey: string;
    fromAddress: string;
  };
  frontendUrl: string;
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
    openai: {
      // Necompletat = AI Assistant dezactivat (vezi AiService) — pornirea
      // aplicației nu trebuie să depindă de existența acestei chei.
      apiKey: process.env.OPENAI_API_KEY ?? '',
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    },
    stripe: {
      // Necompletat = billing dezactivat (vezi BillingService) — la fel ca
      // la OpenAI, pornirea aplicației nu trebuie să depindă de asta.
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    },
    firebase: {
      // Necompletat = push dezactivat (vezi FirebaseService) — notificările
      // rămân vizibile în aplicație (tabelul Notification), doar push-ul
      // efectiv nu se trimite.
      projectId: process.env.FIREBASE_PROJECT_ID ?? '',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
      // Cheia privată vine din JSON-ul de service account, cu `\n` literali
      // în variabila de mediu — trebuie convertiți înapoi în linii noi reale.
      privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    },
    twilio: {
      // Necompletat = SMS dezactivat (vezi TwilioService) — la fel ca la
      // celelalte integrări opționale, pornirea aplicației nu depinde de asta.
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
      fromNumber: process.env.TWILIO_FROM_NUMBER ?? '',
    },
    resend: {
      // Necompletat = trimiterea de email-uri e dezactivată (vezi
      // EmailService) — la fel ca la celelalte integrări opționale,
      // pornirea aplicației nu depinde de asta.
      apiKey: process.env.RESEND_API_KEY ?? '',
      fromAddress: process.env.RESEND_FROM_ADDRESS ?? 'WorkSphere <onboarding@resend.dev>',
    },
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  },
});
