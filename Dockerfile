# syntax=docker/dockerfile:1
FROM node:24.22.1-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages/rules/package.json packages/rules/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm install --global npm@11.9.0 --no-audit --no-fund && npm ci --no-audit --no-fund
COPY tsconfig*.json ./
COPY packages packages
COPY apps apps
RUN npm run build && npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24.22.1-bookworm-slim
ARG BUILD_SHA
RUN node -e "if (!/^[a-f0-9]{40}$/.test(process.argv[1] || '')) process.exit(1)" "$BUILD_SHA"
LABEL org.opencontainers.image.revision=$BUILD_SHA
ENV NODE_ENV=production BUILD_SHA=$BUILD_SHA DATABASE_PATH=/data/cheapshot.sqlite PORT=3000
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/rules/package.json ./packages/rules/package.json
COPY --from=build /app/packages/rules/dist ./packages/rules/dist
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
RUN chmod -R a+rX /app && mkdir /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","apps/server/dist/main.js"]
