# Stage 1: Build stage
FROM node:25-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update || : && apt-get install -y \
    python3 \
    build-essential \
    libsasl2-dev \
    libsasl2-modules \
    libssl-dev \
    git
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install
COPY . .
EXPOSE 5000
ENTRYPOINT [ "node", "src/index.js" ]
