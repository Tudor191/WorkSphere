# syntax=docker/dockerfile:1

# Build context TREBUIE să fie rădăcina monorepo-ului (nu apps/api), pentru
# că pnpm workspaces + pachetele `workspace:*` (ex. @worksphere/database)
# necesită tot arborele. Exemplu build:
#   docker build -f apps/api/Dockerfile -t worksphere-api .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- Dependințe (cache friendly: doar manifestele, fără sursă) ----
# IMPORTANT: pnpm validează lockfile-ul față de TOATE membrii workspace-ului
# declarați în pnpm-workspace.yaml, nu doar cei filtrați mai jos — trebuie
# copiat package.json din fiecare app/pachet, altfel `--frozen-lockfile`
# eșuează cu "importer not found".
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter @worksphere/database run generate
RUN pnpm --filter @worksphere/database run build
RUN pnpm --filter @worksphere/api run build
RUN pnpm deploy --filter @worksphere/api --prod /app/deploy

# ---- Migrator (rulează migrațiile Prisma; păstrează devDependencies,
# spre deosebire de imaginea runtime slim, pentru că are nevoie de CLI-ul
# Prisma) ----
FROM build AS migrator
WORKDIR /app/packages/database
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ---- Runtime ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S worksphere && adduser -S worksphere -G worksphere

COPY --from=build /app/deploy/dist ./dist
COPY --from=build /app/deploy/node_modules ./node_modules

USER worksphere
EXPOSE 3001
CMD ["node", "dist/main.js"]
