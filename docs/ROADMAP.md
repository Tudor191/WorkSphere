# Roadmap — WorkSphere

## Etape (conform cerințe) și status curent

| Etapă | Conținut | Status |
|---|---|---|
| 1. Analiză produs | Acest document + `ARCHITECTURE.md` | ✅ Făcut |
| 2. Wireframe | Structură pagini/dashboard descrisă în `ARCHITECTURE.md` §5 și componentele din `apps/web` | ✅ Implicit prin implementare directă în cod |
| 3. UI Design | Design system Tailwind + shadcn/ui, dark/light mode | ✅ Fundație gata |
| 4. Database | Schema Prisma completă, toate modulele | ✅ Făcut (`packages/database/prisma/schema.prisma`) |
| 5. Backend | NestJS: infra (auth, RBAC, multi-tenancy, audit) + module esențiale | 🟢 Complet pentru scopul v1 — vezi „Ce este funcțional acum" |
| 6. Frontend | Next.js: landing + dashboard shell + module esențiale | 🟢 Complet pentru scopul v1 — vezi „Ce este funcțional acum" |
| 7. AI | OpenAI + RAG | 🟡 Prima felie implementată (fără RAG încă), ținută deliberat în standby — vezi „Ce urmează" |
| 8. Testare | Unit + integration + E2E, 80% coverage | 🟡 E2e reale (Postgres+RLS, nu mock) pe auth/RBAC/izolare multi-tenant + Angajați, Departamente, Concedii, Pontaj, Proiecte, CRM, Inventar, Chat, Notificări; unit teste pe logica pură (calcul zile lucrătoare, plafon concediu) și pe integrările opționale (AI/Stripe/Firebase/Twilio — respingere clară când neconfigurate). Rămân neacoperite doar prin teste automate: billing/AI cu credențiale reale (verificate manual, o singură dată, cu conturi de test reale). Coverage 80% pe tot produsul rămâne prematur |
| 9. Deployment | Docker + CI/CD + Nginx | 🟡 Dockerfile-uri multi-stage (api/web) + docker-compose (Postgres/pgvector, Redis, Nginx) + GitHub Actions (lint/typecheck/build/test/e2e). Build-urile Docker nu au putut fi testate live în acest mediu (egress blocat spre registry-ul Docker Hub) — verificate prin review manual atent, nu prin `docker build` real |
| 10. Lansare Beta | — | ⬜ Neînceput |
| 11. Feedback | — | ⬜ Neînceput |
| 12. Versiunea 1.0 | — | ⬜ Neînceput |

## Ce este funcțional acum (implementat cu adevărat, nu schelet gol)

**Backend (`apps/api`)**
- Multi-tenancy: `TenantContextMiddleware` + `PrismaService` cu filtrare
  automată pe `companyId`, RLS activat în migrația SQL.
- Auth: register companie nouă, login, refresh token cu rotație, logout,
  login prin Google (buton funcțional pe frontend) — inclusiv **înregistrare
  de companie nouă direct prin Google** (nu doar login pe conturi deja
  existente), „Ai uitat parola?" (email cu link de resetare, valabil 1 oră,
  revocă toate sesiunile active la reușită), plus email de bun venit la
  înregistrare — toate prin Resend, opțional (vezi „Ce urmează").
- RBAC: ghid + decorator `@RequirePermission()`, seed cu rolurile standard.
- Audit log: interceptor global care înregistrează automat mutațiile.
- Module CRUD complete: `companies`, `employees` (email automat de
  invitație la creare, cu link de setare a parolei — vezi mai jos),
  `departments`, `roles` (listare, pentru atribuire), `leave-requests` (cu
  calcul zile disponibile), `attendance` (check-in/check-out + calcul ore
  suplimentare), `projects` + `tasks`, `clients` + `leads`, `products` +
  `stock-movements`, `chat` (canale + mesaje).
- `notifications` — listă, contor necitite, marcare citit, preferințe
  proprii (chat/SMS); canale: in-app (mereu), push FCM (opțional,
  confirmat funcțional end-to-end), SMS Twilio (opțional, în standby —
  vezi „Ce urmează").
- `billing` — Stripe Checkout + Billing Portal + webhook, confirmat
  funcțional cu o plată reală de test.
- `ai` — asistent conversațional simplu (OpenAI), ținut deliberat în
  standby (vezi „Ce urmează").
- `platform-admin` — panou separat de administrare a platformei (listă
  companii, hard reset + ștergere chirurgicală a unei singure companii),
  autentificare proprie, izolat de conturile companiilor client.
- Ștergere cont propriu (`DELETE /auth/me`, din Setările contului) —
  autoservire, cere parola curentă (dacă există); dacă e singurul cont din
  companie, șterge toată compania; altfel anonimizează + dezactivează
  contul permanent, păstrând conținutul creat (mesaje, task-uri, documente)
  intact pentru colegi.
- Ștergere automată/accelerată a conturilor demise — la demitere
  (`EmployeesService.remove`), se trimite automat un email (Resend) cu un
  cod de confirmare + link, explicând că vor fi șterse definitiv automat
  peste 7 zile (`@nestjs/schedule`, cron zilnic); fostul angajat poate
  accelera ștergerea oricând în acea perioadă din pagina publică
  `/account-deletion/confirm` (email + parola contului + cod). Ambele căi
  refolosesc aceeași logică de ștergere ca `hardDelete()` (vezi
  `wipeUserContentAndDelete`, `docs/ISSUES.md` #33).
- Swagger la `/api/docs`, validare DTO cu `class-validator`, rate limiting,
  Helmet, CORS configurabil.
- Verificat manual end-to-end (browser real, prin Playwright): înregistrare
  → dashboard → creare departament/angajat → cerere concediu → aprobare →
  pontaj. Testele au depistat și au corectat două bug-uri reale de izolare
  multi-tenant (vezi commit history) înainte de a ajunge în acest stadiu.

**Frontend (`apps/web`)**
- Landing page completă: Hero, Beneficii, Funcționalități, Testimoniale,
  Prețuri, FAQ, Contact, Footer — animații Framer Motion, responsive.
- Autentificare: login, register, onboarding companie, login/înregistrare
  prin Google.
- Dashboard: sidebar + header + dark/light mode, pagini conectate real la
  API pentru Angajați (ascunde implicit foștii angajați/conturile
  suspendate, cu comutator ca să fie oricând vizibile), Departamente,
  Concedii, Pontaj, Overview cu statistici reale din DB, plus Proiecte,
  Clienți, Lead-uri, Produse și Chat.
- Clopoțel de notificări în header — listă, marcare citit, activare push,
  preferință de chat.
- `/dashboard/account` — profil propriu, schimbare parolă, plan/abonament
  (Stripe Checkout + Billing Portal), confirmare vizuală înainte de plată,
  zonă periculoasă cu ștergere cont propriu (confirmare prin tastarea
  emailului + parola curentă).
- `/account-deletion/confirm` — pagină publică (fără autentificare, contul
  demis nu se mai poate loga) pentru accelerarea ștergerii unui cont demis,
  din link-ul primit prin email (email + parolă + cod).
- `/dashboard/assistant` — asistent AI, cod gata dar scos din navigare
  (standby).
- `/dev` — panou separat de platform admin (login propriu, temă forțată
  dark, izolat de tema conturilor de companie).

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
3. **Twilio SMS** — ✅ prima felie implementată (`TwilioService`, opțional,
   la fel ca AI/Stripe/Firebase), dar **ținută deliberat în standby**:
   câmpul de telefon și comutatorul „Notificări prin SMS" sunt scoase din
   `/dashboard/account` (vezi comentariul din fișier) — decizie de
   business, nu bug. Motiv: contul Twilio **trial** nu permite deloc text
   liber la trimitere (doar șabloane fixe, fără variabile — testat direct,
   confirmat cu eroarea API `Invalid template name`), deci mesajele
   noastre dinamice (nume angajat, motiv respingere etc.) nu pot fi
   trimise până la upgrade-ul contului (elimină restricția complet, fără
   nicio schimbare de cod). Codul rămâne complet funcțional; ca s-o
   activăm, e nevoie doar de:
   1. Upgrade cont Twilio (metodă de plată + credit minim).
   2. `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER` în
      mediul API-ului — fără ele, SMS-ul rămâne dezactivat, nu crapă.
   3. Readăugarea câmpului de telefon + comutatorului din
      `apps/web/src/app/(dashboard)/dashboard/account/page.tsx`
      (comentariul de acolo explică exact ce s-a scos).

   Cont personal Twilio, decizie temporară — se poate trece pe alt
   furnizor (Vonage, SMS.ro pentru cost mai bun pe piața locală) fără să
   schimbe restul arhitecturii, doar `TwilioService`. Primul (și singurul,
   deliberat) declanșator cablat, odată activat: aprobarea/respingerea
   unei cereri de concediu — nu și mesajele de chat, prea frecvente ca să
   merite cost per SMS. Rămâne pentru o felie următoare: cablarea altor
   declanșatoare importante (dacă apar).
4. **Firebase Cloud Messaging (push)** — ✅ implementat și **confirmat
   funcțional** printr-o notificare push reală, primită de la un capăt la
   altul (respingere cerere de concediu → notificare în aplicație → push
   FCM → notificare nativă în Windows/Edge, verificat vizual de user).
   `NotificationsModule` (listă, contor necitite, marcare citit,
   înregistrare/dezînregistrare device token, preferințe proprii) +
   clopoțel în header cu buton "Activează notificările push". Declanșatoare
   reale cablate: aprobarea/respingerea unei cereri de concediu notifică
   angajatul; un mesaj nou de chat notifică ceilalți membri ai canalului,
   cu preferință individuală de activare/dezactivare strict pentru chat
   (`chatNotificationsEnabled` pe `User`, comutator direct din clopoțel).
   Are nevoie de un proiect Firebase (gratuit) — vezi `.env.example` din
   `apps/api` (service account) și `apps/web` (config public + cheie
   VAPID). Fără ele, notificările tot apar în aplicație (clopoțel), doar
   push-ul efectiv nu se trimite. Rămâne pentru o felie următoare:
   cablarea altor declanșatoare (alocare task etc.).
5. **Login/Înregistrare prin Google + email tranzacțional (Resend)** — ✅
   implementat și funcțional, activ implicit (nu e în standby ca AI/Twilio,
   fiindcă nu are cost per-utilizator ca acelea). Buton „Continuă cu
   Google" pe `/login` și `/register`; dacă emailul contului Google nu are
   deja un cont, utilizatorul e dus la un pas final (`/register/google`)
   unde completează doar numele companiei — restul (roluri, plan trial,
   tipuri de concediu) se creează exact ca la înregistrarea clasică. La
   orice înregistrare (clasică sau Google) se trimite un email de bun
   venit prin Resend. Aceeași integrare acoperă și „Ai uitat parola?"
   (`/forgot-password` → `/reset-password?token=...`) — token cu durată de
   1 oră, cu hash stocat (niciodată tokenul brut), care revocă toate
   sesiunile active la resetare reușită. Are nevoie de:
   1. `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_CALLBACK_URL` (Google
      Cloud Console → OAuth consent screen + credențiale OAuth 2.0) —
      fără ele, `/auth/google` eșuează la Google (client invalid), nu la
      pornirea aplicației.
   2. `RESEND_API_KEY` (+ opțional `RESEND_FROM_ADDRESS`) — fără ea,
      email-ul de bun venit e dezactivat silențios (restul flow-ului de
      înregistrare nu e afectat). Cont gratuit: resend.com.

   Rămâne pentru o felie următoare: alți furnizori (Facebook a fost luat
   în calcul, dar amânat — nu era cerință clară încă). Email-ul de
   invitație pentru angajați noi (`EmployeesService.create`) e ✅
   implementat — link de setare a parolei (același mecanism ca „Ai uitat
   parola?", valabil 7 zile), cu parola temporară din răspunsul API ca
   fallback dacă emailul nu ajunge.
6. **CRM, Inventar, Proiecte, Chat intern** — schema DB e completă pentru
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
7. **Suită de teste completă (80% coverage)** — construită incremental pe
   măsură ce fiecare modul e implementat, nu retroactiv.
8. **Deploy producție (Coolify/VPS) + backup automat + monitorizare**.

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
