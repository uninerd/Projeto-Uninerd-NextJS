FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit

FROM dependencies AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
RUN addgroup -S uninerd && adduser -S uninerd -G uninerd
COPY --from=build --chown=uninerd:uninerd /app/.next/standalone ./
COPY --from=build --chown=uninerd:uninerd /app/.next/static ./.next/static
USER uninerd
EXPOSE 3001
CMD ["node", "server.js"]
