FROM node:20-alpine

WORKDIR /app

# Copy package descriptors first for layer caching
COPY package.json package-lock.json* ./
RUN npm install

# Copy application source
COPY . .

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Default dev command with hot reloading
CMD ["npm", "run", "dev"]
