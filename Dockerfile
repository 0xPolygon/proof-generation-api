FROM node:24-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    libsasl2-dev \
    libsasl2-modules \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*
RUN npm i -g pnpm@10.30.3
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY src/ ./src/
RUN addgroup --system app && adduser --system --ingroup app app
USER app
EXPOSE 5000
ENTRYPOINT [ "node", "src/bin/apiServer.ts" ]
