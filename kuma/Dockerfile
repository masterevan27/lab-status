# Uptime Kuma built from the fork checkout that compose.yaml passes as the
# `src` build context (KUMA_SRC). It mirrors the release stage of upstream's
# docker/dockerfile and adds the frontend build that upstream's release
# pipeline runs beforehand. Drop it once an upstream release includes the
# status page uptime-range selector (uptime-kuma issue #986).
FROM louislam/uptime-kuma:builder-go AS healthcheck

FROM louislam/uptime-kuma:base2 AS build
USER node
WORKDIR /app
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
COPY --from=src --chown=node:node . .
# A developer checkout may carry its own node_modules and dist: start clean.
RUN rm -rf node_modules dist data \
    && npm ci --no-audit --no-fund \
    && npm run build \
    && npm prune --omit=dev \
    && mkdir data
COPY --from=healthcheck --chown=node:node /app/extra/healthcheck /app/extra/healthcheck

FROM louislam/uptime-kuma:base2
WORKDIR /app
ENV UPTIME_KUMA_IS_CONTAINER=1
COPY --from=build --chown=node:node /app /app
EXPOSE 3001
HEALTHCHECK --interval=60s --timeout=30s --start-period=180s --retries=5 CMD extra/healthcheck
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server/server.js"]
