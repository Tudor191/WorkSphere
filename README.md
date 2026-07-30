# WorkSphere

Platformă SaaS multi-tenant pentru administrarea activității interne a
firmelor din România — HR, pontaj, concedii, CRM, proiecte, inventar,
chat intern și AI assistant, într-un singur loc.

> Status: în dezvoltare activă. Vezi [`docs/ROADMAP.md`](docs/ROADMAP.md)
> pentru ce e funcțional acum și ce urmează.

## Stack tehnic

| Layer | Tehnologie |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | NestJS, TypeScript |
| Bază de date | PostgreSQL + Prisma ORM (Row Level Security pentru multi-tenancy) |
| Cache / Queue | Redis + BullMQ |
| Storage | S3-compatible (AWS S3 / Cloudflare R2) |
| Auth | JWT + Refresh Token rotativ + OAuth Google |
| Plăți | Stripe |
| Email | Resend |
| Deploy | Docker, GitHub Actions, Nginx |

Detalii și motivația fiecărei decizii: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Structură monorepo

```
apps/
  web/               Next.js — landing page + dashboard
  api/               NestJS — REST API
packages/
  database/          Schema Prisma + migrații + seed
  shared-types/       DTO-uri / tipuri partajate (zod)
  config/             tsconfig / eslint partajate
docker/                Configurări Nginx / Docker
docs/                  Documentație (arhitectură, roadmap, DB)
```

## Setup local

### Cerințe

- Node.js 22+
- pnpm 10+
- Docker + Docker Compose (pentru Postgres, Redis local)

### Pași

```bash
# 1. Instalează dependențele
pnpm install

# 2. Pornește infrastructura locală (Postgres + Redis)
docker compose up -d postgres redis

# 3. Copiază variabilele de mediu
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 4. Rulează migrațiile + seed
pnpm db:migrate
pnpm db:seed

# 5. Pornește aplicațiile (API pe :3001, Web pe :3000)
pnpm dev
```

- API docs (Swagger): http://localhost:3001/api/docs
- Web: http://localhost:3000

### Rulare completă în Docker

```bash
docker compose up --build
```

## Comenzi utile

| Comandă | Descriere |
|---|---|
| `pnpm dev` | pornește toate aplicațiile în modul dev |
| `pnpm build` | build de producție pentru toate pachetele |
| `pnpm lint` | rulează ESLint în tot monorepo-ul |
| `pnpm test` | rulează testele unitare |
| `pnpm test:e2e` | rulează testele end-to-end (API) |
| `pnpm db:migrate` | aplică migrațiile Prisma |
| `pnpm db:seed` | populează baza de date cu date demo (companie + roluri + admin) |

## Documentație

- [Arhitectură](docs/ARCHITECTURE.md) — decizii tehnice și motivația lor
- [Roadmap](docs/ROADMAP.md) — etape de dezvoltare, status, funcționalități propuse
- [Bază de date](docs/DATABASE.md) — ERD și explicația fiecărui tabel
