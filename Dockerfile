FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run typecheck

FROM base AS release
COPY --from=deps /app/node_modules ./node_modules
COPY . .

USER bun
ENTRYPOINT ["bun", "run", "start"]
