FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update || : && apt-get install -y \
    python3 \
    build-essential \
    libsasl2-dev \
    libsasl2-modules \
    libssl-dev \
    git
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 5000
ENTRYPOINT [ "node", "src/bin/apiServer.ts" ]
