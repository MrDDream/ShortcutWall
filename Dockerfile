# syntax=docker/dockerfile:1
FROM node:26-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
# npm ci can exit 0 after silently failing to fetch some packages (seen as
# "Exit handler never called!" and/or SELF_SIGNED_CERT_IN_CHAIN behind a TLS-
# intercepting proxy), leaving node_modules truncated. The optional "cacert"
# secret lets a build behind such a proxy point npm at its CA bundle; normal
# builds (CI, local) that don't pass --secret are unaffected. Either way,
# verify a core dependency actually loads and retry from a clean slate if not.
RUN --mount=type=secret,id=cacert,required=false \
    if [ -f /run/secrets/cacert ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/cacert; fi; \
    for attempt in 1 2 3 4 5; do \
      rm -rf node_modules && \
      npm ci --omit=dev --no-audit --no-fund && \
      node -e "require('express')" && exit 0; \
      echo "npm ci attempt $attempt produced a broken install, retrying..."; \
    done; \
    echo "npm ci failed to produce a working install after 5 attempts" >&2; exit 1

COPY . .

# The code stays owned by root, read-only for the app; only the data and logo
# directories are writable by the non-root user below. (A chown -R of /app used
# to copy all of node_modules into an extra 37 MB layer.) Volume-mounted
# directories (see docker-compose.yml) may need matching host ownership
# (uid/gid 1000).
RUN mkdir -p data/sessions public/uploads && chown -R node:node data public/uploads

USER node

EXPOSE 3050

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3050}/healthz" || exit 1

# Node directly rather than through npm: it receives the stop signal itself and
# shuts down gracefully (see server.js).
CMD ["node", "server.js"]
