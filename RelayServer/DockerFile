FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

FROM base AS deps

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY RelayServer/package.json RelayServer/package.json
COPY RelayServer/pnpm-lock.yaml RelayServer/pnpm-lock.yaml
COPY packages/shared-relay/package.json packages/shared-relay/package.json
COPY packages/shared-relay/pnpm-lock.yaml packages/shared-relay/pnpm-lock.yaml

RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY packages ./packages
COPY RelayServer ./RelayServer

RUN pnpm --filter @rtc-database/shared-relay build
RUN pnpm --filter rtc-database-relay build

FROM base AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/.npmrc ./.npmrc
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/RelayServer ./RelayServer

WORKDIR /app/RelayServer

EXPOSE 3000 41234/udp

CMD ["pnpm", "start"]
