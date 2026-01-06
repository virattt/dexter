FROM oven/bun:1.1.34

WORKDIR /app

COPY package.json bun.lockb* ./

RUN bun install

COPY . .

RUN chmod +x src/index.tsx

ENTRYPOINT [ "bun", "run", "src/index.tsx" ]