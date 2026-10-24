FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm i -g pnpm@9
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @acm/shared build && pnpm --filter @acm/api prisma:generate:all && pnpm --filter @acm/api build
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["sh", "-c", "pnpm db:bootstrap && node dist/src/main.js"]
