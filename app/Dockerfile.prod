FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY scripts ./scripts
COPY prisma ./prisma

RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev


FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

COPY --from=builder /app/prisma ./prisma

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
