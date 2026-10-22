FROM node:24.22.0-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack install --global pnpm@12.14.0

WORKDIR /workspace

FROM base AS deps

RUN apk add --no-cache python3 make g++ openssl

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY . .

RUN pnpm --filter @aprender-palabras/api build

FROM base AS runner

ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY --from=build /workspace/package.json /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml /workspace/.npmrc ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api ./apps/api
COPY --from=build /workspace/packages/contracts ./packages/contracts

EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter @aprender-palabras/api db:migrate && pnpm --filter @aprender-palabras/api start:prod"]
