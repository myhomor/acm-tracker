FROM node:20-slim AS build
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm i -g pnpm@9
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @acm/shared build \
 && pnpm --filter @acm/web build \
 && pnpm --filter @acm/api prisma:generate:all \
 && pnpm --filter @acm/api build

FROM node:20-slim AS runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm i -g pnpm@9
WORKDIR /repo
COPY --from=build /repo /repo
ENV DB_BACKEND=sqlite \
    DATABASE_URL=file:/data/acm.db \
    WEB_DIST_DIR=/repo/apps/web/dist \
    UPLOADS_DIR=/data/uploads \
    API_PORT=5173
WORKDIR /repo/apps/api
EXPOSE 5173
VOLUME ["/data"]
COPY docker/entrypoint.sh /usr/local/bin/acm-entrypoint
RUN chmod +x /usr/local/bin/acm-entrypoint
ENTRYPOINT ["/usr/local/bin/acm-entrypoint"]
