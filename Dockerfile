# syntax=docker/dockerfile:1
FROM node:24.22.1-bookworm@sha256:d862bb5d082c5ae0210ac07e8c0344cb8cf7bef6d78e9b8c50c179da923108ea AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc tsconfig*.json ./
COPY packages packages
COPY apps apps
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm install --global npm@11.9.0 --no-audit --no-fund && \
    npm ci --no-audit --no-fund && npm run build && \
    npm prune --omit=dev --ignore-scripts --no-audit --no-fund && \
    mkdir -p /runtime/packages/rules /runtime/apps/server /runtime/apps/web && \
    cp package.json /runtime/ && cp -R node_modules /runtime/ && \
    cp packages/rules/package.json /runtime/packages/rules/ && cp -R packages/rules/dist /runtime/packages/rules/ && \
    cp apps/server/package.json /runtime/apps/server/ && cp -R apps/server/dist /runtime/apps/server/ && \
    cp -R apps/web/dist /runtime/apps/web/ && chmod -R a+rX /runtime && \
    rm -rf /root/.npm /root/.cache

FROM node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
ARG BUILD_SHA
RUN node -e "if (!/^[a-f0-9]{40}$/.test(process.argv[1] || '')) process.exit(1)" "$BUILD_SHA" && mkdir /data && chown node:node /data
LABEL org.opencontainers.image.revision=$BUILD_SHA
ENV NODE_ENV=production BUILD_SHA=$BUILD_SHA DATABASE_PATH=/data/cheapshot.sqlite PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /runtime/ ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","apps/server/dist/main.js"]
