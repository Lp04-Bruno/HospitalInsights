FROM node:24.16.0-alpine AS builder

WORKDIR /app

ENV DATABASE_URL=postgresql://hospitalinsights:hospitalinsights_pw@localhost:5432/hospitalinsights?schema=public

RUN apk add --no-cache ca-certificates openssl

COPY package.json package-lock.json* ./
COPY scripts ./scripts
COPY prisma ./prisma

RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24.16.0-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache ca-certificates postgresql18-client

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts/validate-runtime-env.mjs ./scripts/validate-runtime-env.mjs
COPY --from=builder /app/prisma ./prisma

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
	&& chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
