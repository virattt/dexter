FROM oven/bun:1 AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV DEXTER_ALLOW_OPEN_WHATSAPP=false
ENV DEXTER_ALLOW_PRIVATE_NETWORK=false
ENV DEXTER_ENABLE_AUTOMATION=false
ENV DEXTER_ENABLE_BROWSER=false
ENV DEXTER_ENABLE_MEMORY=false

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile --ignore-scripts
RUN bunx playwright install --with-deps chromium

COPY --chown=bun:bun . .
RUN mkdir -p /app/.dexter /home/bun/.cache \
  && chown -R bun:bun /app /home/bun /ms-playwright

USER bun

CMD ["bun", "run", "start"]
