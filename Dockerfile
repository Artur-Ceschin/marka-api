FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY --from=builder /app/dist ./dist
EXPOSE 3333
CMD ["node", "dist/server.js"]
