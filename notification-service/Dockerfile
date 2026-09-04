FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN apk add --no-cache wget
CMD ["node", "dist/main"]
