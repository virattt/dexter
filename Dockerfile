FROM oven/bun:1

WORKDIR /app

# Copy package files for layer caching
COPY package.json bun.lock ./

# Install dependencies (postinstall runs: playwright install chromium)
RUN bun install

# Install Chromium system-level dependencies for Playwright
RUN ./node_modules/.bin/playwright install-deps chromium

# Copy the rest of the source
COPY . .

CMD ["bun", "run", "src/index.tsx"]
