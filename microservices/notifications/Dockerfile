FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && mkdir /data && chown node:node /data
COPY src ./src
USER node
EXPOSE 3002
CMD ["node", "src/server.mjs"]
