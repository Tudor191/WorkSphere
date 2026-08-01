# Roadmap — WorkSphere

## Etape (conform cerințe) și status curent

| Etapă | Conținut | Status |
|---|---|---|
| 1. Analiză produs | Acest document + `ARCHITECTURE.md` | ✅ Făcut |
| 2. Wireframe | Structură pagini/dashboard descrisă în `ARCHITECTURE.md` §5 și componentele din `apps/web` | ✅ Implicit prin implementare directă în cod |
| 3. UI Design | Design system Tailwind + shadcn/ui, dark/light mode | ✅ Fundație gata |
| 4. Database | Schema Prisma completă, toate modulele | ✅ Făcut (`packages/database/prisma/schema.prisma`) |
| 5. Backend | NestJS: infra (auth, RBAC, multi-tenancy, audit) + module esențiale | 🟡 Parțial — vezi mai jos |
| 6. Frontend | Next.js: landing + dashboard shell + module esențiale | 🟡 Parțial — vezi mai jos |
| 7. AI | OpenAI + RAG | ⬜ Neînceput — vezi „Ce urmează" |
| 8. Testare | Unit + integration + E2E, 80% coverage | 🟡 Teste unitare + e2e reale (auth, RBAC, izolare multi-tenant) pe modulele implementate; coverage 80% pe tot produsul e prematur la acest stadiu |
| 9. Deployment | Docker + CI/CD + Nginx | 🟡 Dockerfile-uri multi-stage (api/web) + docker-compose (Postgres/pgvector, Redis, Nginx) + GitHub Actions (lint/typecheck/build/test/e2e). Build-urile Docker nu au putut fi testate live în acest mediu (egress blocat spre registry-ul Docker Hub) — verificate prin review manual atent, nu prin `docker build` real |
| 10. Lansare Beta | — | ⬜ Neînceput |
| 11. Feedback | — | ⬜ Neînceput |
| 12. Versiunea 1.0 | — | ⬜ Neînceput |

## Ce este funcțional acum (implementat cu adevărat, nu schelet gol)

**Backend (`apps/api`)**
- Multi-tenancy: `TenantContextMiddleware` + `PrismaService` cu filtrare
  automată pe `companyId`, RLS activat în migrația SQL.
- Auth: register companie nouă, login, refresh token cu rotație, logout,
  Google OAuth (strategie Passport configurată).
- RBAC: ghid + decorator `@RequirePermission()`, seed cu rolurile standard.
- Audit log: interceptor global care înregistrează automat mutațiile.
- Module CRUD complete: `companies`, `employees`, `departments`, `roles`
  (listare, pentru atribuire), `leave-requests` (cu calcul zile disponibile),
  `attendance` (check-in/check-out + calcul ore suplimentare), `projects` +
  `tasks`, `clients` + `leads`, `products` + `stock-movements`, `chat`
  (canale + mesaje).
- Swagger la `/api/docs`, validare DTO cu `class-validator`, rate limiting,
  Helmet, CORS configurabil.
- Verificat manual end-to-end (browser real, prin Playwright): înregistrare
  → dashboard → creare departament/angajat → cerere concediu → aprobare →
  pontaj. Testele au depistat și au corectat două bug-uri reale de izolare
  multi-tenant (vezi commit history) înainte de a ajunge în acest stadiu.

**Frontend (`apps/web`)**
- Landing page completă: Hero, Beneficii, Funcționalități, Testimoniale,
  Prețuri, FAQ, Contact, Footer — animații Framer Motion, responsive.
- Autentificare: login, register, onboarding companie.
- Dashboard: sidebar + header + dark/light mode, pagini conectate real la
  API pentru Angajați, Departamente, Concedii, Pontaj, Overview cu
  statistici reale din DB, plus Proiecte, Clienți, Lead-uri, Produse și
  Chat.

## Ce urmează (nu a fost implementat fals — necesită decizii de business)

1. **AI Assistant + RAG** — ✅ prima felie implementată și funcțională
   (`POST /ai/chat`, asistent conversațional simplu, fără persistență
   server-side a conversației, fără RAG încă), dar **ținută deliberat în
   standby**: linkul din sidebar (`/dashboard/assistant`) e scos din
   navigare — decizie de business, nu bug, ca să nu cheltuim pe credite
   OpenAI înainte de primii clienți plătitori. Codul rămâne complet
   funcțional; ca s-o activăm, e nevoie doar de:
   1. `OPENAI_API_KEY` (+ opțional `OPENAI_MODEL`) în mediul API-ului —
      fără ea, endpoint-ul întoarce clar 503, nu crapă.
   2. Readăugarea intrării de sidebar din `apps/web/src/components/dashboard/sidebar.tsx`
      (comentariul de acolo explică exact ce s-a scos).

   Plan: activăm când avem primii clienți, sau mai devreme dacă vedem
   cerere clară (volum mare de întrebări către suport care ar putea fi
   preluate de asistent).

   Rămâne pentru o felie următoare, indiferent de momentul activării:
   RAG-ul propriu-zis peste documente
   (`Document`/`DocumentChunk`/`DocumentEmbedding`, pgvector) — are nevoie
   întâi de o decizie asupra stocării fișierelor (S3/MinIO/disc local),
   nefăcută încă — plus rate limiting pe tokeni per companie
   (`SubscriptionPlan.aiCreditsPerMonth` există în schemă, dar nu e încă
   aplicat).
2. **Stripe billing** — ✅ implementat și **confirmat funcțional** printr-un
   checkout real, de la un capăt la altul (plată test → webhook →
   activare plan Pro, verificat vizual de user). Cont Stripe personal, în
   test mode (decizie temporară — trece pe cont de firmă odată ce firma e
   înregistrată legal și beta e mai avansat). `POST
   /billing/checkout` (Stripe Checkout găzduit), `POST /billing/portal`
   (Stripe Billing Portal găzduit — plată/anulare), `POST /billing/webhook`
   (sincronizează status/perioadă/plan + facturi din evenimente Stripe).
   Are nevoie de `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` în mediul
   API-ului (fără ele, 503 clar, nu crash) și de rularea o singură dată a
   `pnpm --filter @worksphere/database setup-stripe-plans` (creează
   Product/Price în Stripe pentru planurile `basic`/`pro` și salvează
   ID-urile în DB). Rămâne pentru o felie următoare: rate limiting pe
   tokeni AI legat de plan (`aiCreditsPerMonth`), facturare anuală
   promovată explicit în UI (backend-ul o suportă deja prin
   `billingCycle`).
3. **Twilio SMS / alternativă europeană** — necesită cont și decizie
   (Twilio vs. Vonage vs. SMS.ro pentru cost mai bun pe piața locală).
4. **Firebase Cloud Messaging (push)** — ✅ implementat și **confirmat
   funcțional** printr-o notificare push reală, primită de la un capăt la
   altul (respingere cerere de concediu → notificare în aplicație → push
   FCM → notificare nativă în Windows/Edge, verificat vizual de user).
   `NotificationsModule` (listă, contor necitite, marcare citit,
   înregistrare/dezînregistrare device token) + clopoțel în header cu
   buton "Activează notificările push". Primul declanșator real cablat:
   aprobarea/respingerea unei cereri de concediu notifică angajatul.
   Are nevoie de un proiect Firebase (gratuit) — vezi `.env.example` din
   `apps/api` (service account) și `apps/web` (config public + cheie
   VAPID). Fără ele, notificările tot apar în aplicație (clopoțel), doar
   push-ul efectiv nu se trimite. Rămâne pentru o felie următoare:
   cablarea altor declanșatoare (mesaj chat, alocare task etc.).
5. **CRM, Inventar, Proiecte, Chat intern** — schema DB e completă pentru
   toate.
   - **Proiecte**: ✅ prima felie implementată — API complet (Projects +
     Tasks) și UI (listă proiecte, panou pe 4 coloane de status per
     proiect). Rămân pentru o felie următoare: membri expliciți de
     proiect (`ProjectMember`), comentarii pe task (`TaskComment`),
     atașamente (`TaskAttachment`) și time-tracking (`TimeEntry`).
   - **CRM**: ✅ prima felie implementată — Clienți (CRUD) și Lead-uri
     (panou pe status, `LeadStatus`). Rămân pentru o felie următoare:
     `PipelineStage` (etape de pipeline configurabile per companie,
     în loc de enumul fix) și `CrmNote` (notițe pe client/lead).
   - **Inventar**: ✅ prima felie implementată — Produse (CRUD, SKU unic
     per companie) și mișcări de stoc (intrare/ieșire, actualizează
     `stockQuantity` atomic; ștergerea unui produs e blocată cât timp
     mai are stoc).
   - **Chat intern**: ✅ prima felie implementată — canale publice/private
     cu membri expliciți, mesaje. Livrarea e prin polling (4s), nu
     WebSocket — real-time propriu-zis rămâne pentru o felie următoare.

   Cu asta, toate cele patru module din acest punct au o primă felie
   funcțională; ce rămâne pe fiecare e listat mai sus, individual.
6. **Suită de teste completă (80% coverage)** — construită incremental pe
   măsură ce fiecare modul e implementat, nu retroactiv.
7. **Deploy producție (Coolify/VPS) + backup automat + monitorizare**.

## Funcționalități propuse suplimentare (cresc valoarea comercială pe piața RO)

Nu sunt în cerința inițială, dar recomand includerea lor — motiv pe scurt:

1. **e-Factura / SPV (ANAF)** — obligatorie legal pentru B2B în România.
   Fără asta, modulul de facturare nu poate fi folosit real de nicio firmă
   românească. Prioritate maximă înainte de lansare comercială RO.
2. **Onboarding wizard pentru companie nouă** — reduce time-to-value,
   standard în orice SaaS modern (Notion, Linear).
3. **Internaționalizare (RO/EN)** — piața țintă e România, dar mulți
   angajatori au și angajați/parteneri non-vorbitori de română.
4. **Impersonation mode pentru suport** (Super Admin se autentifică "ca"
   o companie, cu audit log strict) — esențial operațional, fără el orice
   ticket de suport necesită acces direct la DB.
5. **Export/ștergere date (GDPR — drept la portabilitate și la ștergere)**
   — obligație legală UE, nu opțional pentru un SaaS B2B european.
6. **API keys per companie pentru integrări externe** (diferit de JWT-ul
   intern) — companiile vor conecta WorkSphere la alte unelte (Zapier,
   n8n, contabilitate).
7. **Integrare software contabilitate RO** (SAGA/ONE/ContaBil export) —
   diferențiator real față de Monday/ClickUp care nu au așa ceva pentru RO.
8. **PWA + geolocație pentru check-in/check-out mobil** — cerința
   menționează "geolocație opțională" la pontaj; o aplicație mobilă/PWA e
   necesară practic pentru asta (angajații nu pontează de pe desktop).
9. **Status page public + monitorizare uptime** — încredere pentru clienți
   B2B înainte de a semna un abonament anual.

Acestea sunt propuneri — nu au fost implementate încă, pentru a nu lua
decizii de business (preț, furnizor SMS, etc.) fără confirmare.
