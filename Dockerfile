FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production

ENTRYPOINT ["bun", "run", "src/index.tsx"]
