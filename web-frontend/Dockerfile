FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY vite.config.ts tsconfig.json tsconfig.node.json ./
COPY src ./src
COPY index.html ./

RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

RUN npm install -g http-server

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["http-server", "dist", "-p", "3000"]
