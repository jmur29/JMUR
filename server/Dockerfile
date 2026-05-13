FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 3001
CMD ["npm", "run", "dev"]
