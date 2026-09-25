FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Writable at runtime by the non-root user below; volume-mounted directories
# (see docker-compose.yml) may need matching host ownership (uid/gid 1000).
RUN mkdir -p data/sessions public/uploads && chown -R node:node /app

USER node

EXPOSE 3050

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3050}/healthz" || exit 1

CMD ["npm", "run", "start"]
