# Stage 1: Install dependencies
FROM oven/bun:1-debian AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Production image
FROM oven/bun:1-debian
WORKDIR /app

# Install system dependencies required by Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libx11-xcb1 libxcb1 libx11-6 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install Playwright Chromium (skipped in bun install since postinstall
# only runs in non-frozen mode; install it explicitly here)
RUN bunx playwright install chromium

ENV NODE_ENV=production

CMD ["bun", "run", "src/index.tsx"]
