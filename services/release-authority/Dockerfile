FROM node:22-alpine

WORKDIR /app

RUN addgroup -S releaseauth && adduser -S releaseauth -G releaseauth

COPY package.json ./
COPY schema.sql ./
COPY src ./src

RUN npm install --omit=dev --no-audit --no-fund && chown -R releaseauth:releaseauth /app

USER releaseauth

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.mjs"]
