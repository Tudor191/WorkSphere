# syntax=docker/dockerfile:1

# Build context TREBUIE să fie rădăcina monorepo-ului. Exemplu build:
#   docker build -f apps/web/Dockerfile -t worksphere-web .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# IMPORTANT: pnpm validează lockfile-ul față de TOATE membrii workspace-ului
# declarați în pnpm-workspace.yaml — trebuie copiat package.json din
# fiecare app/pachet, altfel `--frozen-lockfile` eșuează cu "importer not found".
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter @worksphere/web run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S worksphere && adduser -S worksphere -G worksphere

COPY --from=build /app/apps/web/public ./public
COPY --from=build --chown=worksphere:worksphere /app/apps/web/.next/standalone ./
COPY --from=build --chown=worksphere:worksphere /app/apps/web/.next/static ./apps/web/.next/static

USER worksphere
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
