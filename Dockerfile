# 1. Stage deps: tải Production Dependencies ĐỂ DÀNH
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
COPY prisma.config.ts ./
COPY src/infrastructure/database/prisma/ ./src/infrastructure/database/prisma/
RUN yarn install --production --frozen-lockfile
RUN yarn add prisma@6 --production

# 2. Stage builder: cài full tĩnh và build code
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
COPY prisma.config.ts ./
COPY src/infrastructure/database/prisma/ ./src/infrastructure/database/prisma/
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# 3. Stage runner
FROM node:22-alpine AS runner
ENV NODE_ENV='production'
WORKDIR /app

# Lấy 'node_modules' SẠCH từ tầng 'deps'
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma.config.ts ./ 
COPY --from=builder /app/src/infrastructure/database/prisma/ ./src/infrastructure/database/prisma/

CMD ["yarn", "start:prod"]

