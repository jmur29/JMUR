FROM node:20-alpine
WORKDIR /app

# openssl needed by Prisma; chromium needed by Puppeteer (PDF reports)
RUN apk add --no-cache chromium openssl
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3001

# Run DB migrations then start the compiled server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
