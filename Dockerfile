FROM node:20-alpine AS base
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_ESLINT=0
ENV NEXT_DISABLE_TYPE_CHECKS=1

FROM base AS builder
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/cache ./.next/cache
COPY --from=builder /app/next.config.js .
COPY --from=builder /app/next-env.d.ts .
RUN chown -R node:node /app
USER node
EXPOSE 3001
CMD ["npm", "start"]
