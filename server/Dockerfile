FROM node:20-alpine
WORKDIR /app

# openssl needed by Prisma; chromium needed by Puppeteer (PDF reports)
RUN apk add --no-cache chromium openssl
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm install

COPY . .
RUN ./node_modules/.bin/prisma generate
RUN npm run build

EXPOSE 3001

# Push schema changes (additive) then start the compiled server
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --accept-data-loss && node dist/index.js"]
