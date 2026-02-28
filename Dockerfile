# Multi-stage build for Dexter Finance Agent
FROM oven/bun:latest AS base

WORKDIR /app

# Install dependencies (ignore lockfile, regenerate in container)
COPY package.json ./
RUN bun install

# Copy source code
COPY . .

# Build TypeScript
RUN bun run build

# Production stage
FROM oven/bun:latest AS production

WORKDIR /app

# Install production dependencies only
COPY package.json ./
RUN bun install --production

# Copy built files
COPY --from=base /app/dist ./dist
COPY --from=base /app/src ./src

# Set environment
ENV NODE_ENV=production

# Run as non-root user
RUN addgroup -g 1001 -S bun && \
    adduser -S bun -u 1001 && \
    chown -R bun:bun /app
USER bun

# Default command
CMD ["bun", "run", "start"]
