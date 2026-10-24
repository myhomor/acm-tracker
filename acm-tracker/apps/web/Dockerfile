FROM node:20-alpine
RUN npm i -g pnpm@9
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @acm/shared build && pnpm --filter @acm/web build
WORKDIR /repo/apps/web
EXPOSE 5173
CMD ["pnpm", "exec", "vite", "preview", "--host", "0.0.0.0", "--port", "5173"]
