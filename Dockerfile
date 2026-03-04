# Stage 1: Build
FROM node:22-alpine AS build
RUN apk add --no-cache python3 g++ make vips-dev
WORKDIR /app
COPY package*.json ./
COPY server/package*.json server/
RUN npm ci && cd server && npm ci
COPY client/package*.json client/
RUN cd client && npm ci
COPY client/ client/
RUN cd client && npm run build
# Prune dev deps
RUN npm prune --omit=dev && cd server && npm prune --omit=dev

# Stage 2: Production
FROM node:22-alpine
RUN apk add --no-cache vips
WORKDIR /app
COPY server/ server/
COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/client/dist ./client/dist
RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app
RUN mkdir -p /app/data && chown -R app:app /app
USER app
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
CMD ["node", "server/index.js"]
