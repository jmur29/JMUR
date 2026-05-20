# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Stage 2: production ─────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Chromium for Puppeteer PDF generation.
# chromium-chromedriver not needed — just the browser.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
    && rm -rf /var/cache/apk/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production
# Chromium sandbox flags for containerized environments
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu"

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm rebuild @prisma/client

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

EXPOSE 3001

# Tini for proper signal handling (PID 1)
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]

# ── Stage 3: dev (used by docker-compose) ───────────────────────────────────
FROM node:20-alpine AS dev
WORKDIR /app
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 3001
CMD ["npm", "run", "dev"]
