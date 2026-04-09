FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
COPY gateway ./gateway

# Build TypeScript
RUN npm run build

EXPOSE 4000 8080

# Default to running both services
CMD ["npm", "run", "dev"]
