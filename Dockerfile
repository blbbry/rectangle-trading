FROM node:22-alpine

WORKDIR /app

# Backend deps
COPY package*.json ./
RUN npm ci --omit=dev

# Frontend deps + build
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY . .
RUN cd client && npm run build

EXPOSE 3001

CMD ["node", "server.js"]
