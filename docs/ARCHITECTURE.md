# Arhitectură — WorkSphere

WorkSphere este o platformă SaaS multi-tenant pentru administrarea activității
interne a firmelor (HR, pontaj, CRM, proiecte, inventar, AI assistant).

Acest document explică deciziile tehnice majore și motivul din spatele lor.
Pentru fiecare decizie am luat în calcul alternative reale, nu am ales
implicit prima soluție.

## 1. Monorepo vs. multi-repo

**Ales: Monorepo (pnpm workspaces + Turborepo)**

| | Monorepo | Multi-repo |
|---|---|---|
| Tipuri partajate FE↔BE | Automat, un singur `packages/shared-types` | Trebuie publicat un pachet npm separat, sincronizare manuală |
| Commit atomic pentru schimbări cross-stack | Da | Nu — necesită PR-uri coordonate în 2+ repo-uri |
| CI/CD | Un singur pipeline, cache incremental (Turborepo) | Pipeline-uri duplicate |
| Onboarding | Un singur `git clone` | Multiple repo-uri de clonat și sincronizat |
| Dezavantaj | Repo mai mare, necesită tooling (Turborepo) pentru build selectiv | — |

Pentru o echipă mică/medie care dezvoltă simultan API + Web + schema DB,
monorepo reduce semnificativ frecarea. Turborepo oferă cache de build și
rulare selectivă (doar pachetele afectate de un commit sunt rebuild-uite),
deci dezavantajul de "repo mare" e mitigat.

## 2. Arhitectura Multi-Tenant

Cerința: mii de firme simultan, izolare completă a datelor, cost operațional
scăzut.

**Alternative:**

1. **Database-per-tenant** — fiecare firmă are propria bază de date.
   Izolare maximă, dar: migrații trebuie rulate pe mii de baze de date,
   connection pooling devine imposibil de gestionat la scară (Postgres are
   o limită practică de conexiuni), cost infrastructură foarte mare.
2. **Schema-per-tenant** (un schema Postgres per firmă în aceeași bază) —
   izolare bună, dar migrațiile Prisma trebuie rulate per schema (mii de
   migrații la fiecare deploy), iar Prisma nu are suport nativ robust
   pentru schema dinamică per-request.
3. **Shared database, shared schema, coloană `companyId`** — toate firmele
   în aceleași tabele, discriminate printr-o coloană `companyId` (FK către
   `Company`). Izolarea se impune la două niveluri:
   - **Nivel aplicație**: un `PrismaService` extins care injectează automat
     `WHERE companyId = X` prin Prisma Client Extensions, plus un
     `TenantContext` (AsyncLocalStorage) populat din JWT/subdomeniu la
     fiecare request.
   - **Nivel bază de date (defense-in-depth)**: PostgreSQL **Row Level
     Security (RLS)** cu o politică pe fiecare tabel tenant-scoped,
     verificând `current_setting('app.current_company_id')`. Chiar dacă
     un bug de aplicație omite filtrul, DB-ul refuză accesul cross-tenant.

**Ales: opțiunea 3.** Este soluția standard pentru SaaS-uri care trebuie să
scaleze la mii de tenanți (folosită de ex. de Supabase, multe platforme
B2B) — o singură bază de date, migrații simple (o singură rulare per
deploy), cost predictibil, izolare garantată prin RLS + strat aplicație.
Costul e disciplina: fiecare model tenant-scoped trebuie să aibă
`companyId` și fiecare query trebuie să treacă prin contextul de tenant.

Tabelele globale (nu tenant-scoped): `Company`, `PlatformAdmin`,
`SubscriptionPlan`.

## 3. Autentificare & Autorizare

- **JWT access token** (15 min) semnat cu RS256, conține `sub` (userId),
  `companyId`, `roleId`.
- **Refresh token** opac, random (nu JWT), stocat hash-uit (SHA-256) în DB,
  livrat ca cookie `httpOnly` + `Secure` + `SameSite=Lax`, cu rotație la
  fiecare refresh (refresh token folosit o singură dată — token reuse
  detection = revocare toate sesiunile utilizatorului).
- **OAuth Google** via Passport (`passport-google-oauth20`) — la primul
  login se creează automat un `User` legat de compania curentă (invitație)
  sau se pornește flow de onboarding companie nouă.
- **2FA** (TOTP, ex. Google Authenticator) — planificat pentru Etapa 8,
  schema DB îl are deja pregătit (`User.twoFactorSecret`, `twoFactorEnabled`).

De ce refresh token opac și nu tot JWT? Un JWT de refresh nu poate fi
revocat individual fără o blocklist — folosind un token opac stocat în DB
putem revoca instant o sesiune (logout, "deconectează toate device-urile",
detectare furt de token).

### RBAC granular

În loc de roluri hard-codate în enum, folosim:

```
Role (per companie: Admin, Manager, HR, Contabil, Angajat, + roluri custom)
  ↔ RolePermission ↔ Permission (resource + action, ex: "employees:delete")
```

Motiv: cerința explicită "permisiunile trebuie gestionate granular" înseamnă
că un Admin de companie trebuie să poată crea roluri custom (ex. "Team Lead"
cu acces doar la task-urile echipei lui) fără a necesita deploy de cod.
`Super Admin` (platformă) e separat de `Role`-urile per-companie — el
gestionează firme, planuri, billing la nivel de platformă.

## 4. Cache & Performanță

- **Redis**: sesiuni refresh-token blocklist, cache pentru query-uri
  frecvente (statistici dashboard), rate-limiting store (`@nestjs/throttler`
  cu storage Redis pentru a funcționa corect în cluster multi-instanță),
  coadă BullMQ pentru joburi async (trimitere email, indexare RAG,
  generare rapoarte PDF).
- **Next.js**: Server Components pentru randare inițială rapidă, ISR pentru
  landing page, `next/image` pentru optimizare imagini, code-splitting
  automat per rută.

## 5. Structura folderelor

```
WorkSphere/
├── apps/
│   ├── web/                 # Next.js 14 (App Router) — landing + dashboard
│   └── api/                 # NestJS — REST API
├── packages/
│   ├── database/            # Schema Prisma + client generat + seed
│   ├── shared-types/        # DTO-uri/tipuri partajate FE↔BE (zod + TS types)
│   └── config/              # tsconfig, eslint, prettier partajate
├── docker/
│   └── nginx/                # reverse proxy config
├── .github/workflows/        # CI (lint, test, build)
├── docs/                      # documentația proiectului (acest folder)
├── docker-compose.yml
└── turbo.json
```

### De ce `packages/shared-types` și nu doar tipuri generate de Prisma?

Prisma generează tipurile pentru modele DB, dar API-ul expune DTO-uri
(request/response) care nu sunt 1:1 cu schema DB (ex: parole excluse,
câmpuri calculate, paginare). Folosim `zod` pentru schema de validare
DTO — o singură sursă de adevăr, folosită atât pentru validare pe backend
(`nestjs-zod`) cât și pentru type-safety pe frontend (`z.infer`).

## 6. De ce NestJS și nu Express/Fastify simplu

NestJS oferă din start: modularitate (fiecare feature = modul izolat,
aliniat cu Clean Architecture), Dependency Injection (testabilitate),
Guards/Interceptors/Pipes ca mecanisme first-class pentru auth, RBAC,
audit logging și validare — exact mecanismele cerute. Un Express simplu ar
necesita reinventarea acestor pattern-uri manual, cu risc de inconsistență
între module.

## 7. Layere per modul (Clean Architecture / DDD light)

Fiecare modul de business (`employees`, `leave-requests`, etc.) urmează:

```
module/
├── domain/           # entități + reguli de business pure (fără dependențe framework)
├── application/       # use-cases / services (orchestrare)
├── infrastructure/     # repository Prisma, adaptoare externe
└── presentation/       # controller + DTO (HTTP layer)
```

Nu aplicăm DDD complet (agregate/event sourcing) peste tot — ar fi
over-engineering pentru module CRUD simple (ex. `Department`). Aplicăm
separarea domain/application strict acolo unde există logică de business
reală (ex: calcul zile de concediu disponibile, aprobare cerere concediu
cu reguli, pontaj cu recalcul ore suplimentare).

## 8. Documente conexe

- `docs/DATABASE.md` — ERD și explicația fiecărui tabel/relație
- `docs/ROADMAP.md` — etapele de dezvoltare și status curent
- Swagger live la `/api/docs` — documentația API generată din cod
