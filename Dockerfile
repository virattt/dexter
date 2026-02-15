FROM oven/bun:latest

RUN apt-get update && apt-get install -y \
    libgbm-dev \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2t64 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN bun install

# Install Playwright browsers (Chromium only as per package.json)
RUN bun playwright install chromium

# Copy the remaining application code
COPY . .

# Set the environment variable to ensure Ink works correctly in Docker
ENV TERM=xterm-256color

# Command to run the application
ENTRYPOINT ["bun", "run", "start"]
