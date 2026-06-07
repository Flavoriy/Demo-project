# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat openssl

FROM base AS deps

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG DATABASE_URL
# Đưa biến ARG đó thành biến Môi trường ENV phục vụ cho lệnh build kế tiếp
ENV DATABASE_URL=$DATABASE_URL

RUN npm run build

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs \
    && adduser -S nextjs -G nodejs

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY next.config.ts ./next.config.ts

RUN npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force

COPY --from=builder --chown=nextjs:nodejs --chmod=555 /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs --chmod=555 /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start"]
