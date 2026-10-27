FROM node:24-alpine AS builder

RUN apk add --no-cache python3 make g++
WORKDIR /app/api-ts
COPY api-ts/package*.json ./
RUN npm ci
COPY api-ts/ ./
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app/api-ts
COPY --from=builder --chown=node:node /app/api-ts/package*.json ./
COPY --from=builder --chown=node:node /app/api-ts/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/api-ts/dist ./dist
COPY --chown=node:node database/ /app/database/
RUN mkdir -p data && chown node:node data
USER node

EXPOSE 3000
CMD ["node", "dist/index.js"]
