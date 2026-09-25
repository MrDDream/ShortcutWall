FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
# npm ci can occasionally exit 0 after an internal failure ("Exit handler
# never called!", a known npm bug) while leaving node_modules truncated.
# Verify a core dependency actually loads and retry from a clean slate if not.
RUN for attempt in 1 2 3 4 5; do \
      rm -rf node_modules && \
      npm ci --omit=dev --no-audit --no-fund && \
      node -e "require('express')" && exit 0; \
      echo "npm ci attempt $attempt produced a broken install, retrying..."; \
    done; \
    echo "npm ci failed to produce a working install after 5 attempts" >&2; exit 1

COPY . .

# Writable at runtime by the non-root user below; volume-mounted directories
# (see docker-compose.yml) may need matching host ownership (uid/gid 1000).
RUN mkdir -p data/sessions public/uploads && chown -R node:node /app

USER node

EXPOSE 3050

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3050}/healthz" || exit 1

CMD ["npm", "run", "start"]
