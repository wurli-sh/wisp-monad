FROM node:22-bookworm-slim

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/crypto/package.json packages/crypto/
COPY packages/config packages/config/
COPY deployments deployments/

RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY packages/crypto packages/crypto
COPY apps/api apps/api

ENV NODE_ENV=production
EXPOSE 8787

WORKDIR /app/apps/api
USER node

CMD ["node", "--import", "tsx/esm", "src/server.ts"]
