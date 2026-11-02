FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG BACKEND_URL=http://backend:3001
ENV BACKEND_URL=$BACKEND_URL
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S uninerd && adduser -S uninerd -G uninerd
COPY --from=build --chown=uninerd:uninerd /app/.next/standalone ./
COPY --from=build --chown=uninerd:uninerd /app/.next/static ./.next/static
USER uninerd
EXPOSE 3000
CMD ["node", "server.js"]
