FROM node:22-alpine AS base

WORKDIR /app

ENV NODE_ENV=production
ENV TURBO_TELEMETRY_DISABLED=1
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=1

RUN corepack enable pnpm

# =========================================================================== #

FROM base AS builder

RUN pnpm install --global turbo@^2

COPY . .

# https://turbo.build/repo/docs/guides/tools/docker#the-solution
RUN turbo prune web --docker

# =========================================================================== #

FROM base AS installer

COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm build

# =========================================================================== #

FROM node:22-alpine AS production

WORKDIR /app

RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app

# Copy built SPA and the static file server
COPY --from=installer /app/apps/web/dist ./dist
COPY apps/web/serve.js ./serve.js
COPY apps/web/entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

USER app

ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --quiet --spider http://0.0.0.0:8080/healthcheck || exit 1

CMD ["./entrypoint.sh"]
