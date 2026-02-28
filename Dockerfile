# Simple single-stage build for Dexter Finance Agent
FROM oven/bun:latest

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN bun install

# Copy source code
COPY . .

# Set environment
ENV NODE_ENV=production

# Run as non-root user (bun user already exists in oven/bun image)
RUN chown -R bun:bun /app
USER bun

# Default command
CMD ["bun", "run", "start"]
