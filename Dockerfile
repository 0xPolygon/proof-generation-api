# Stage 1: Build stage
FROM oven/bun:1.2-alpine AS builder
WORKDIR /app
COPY . .
RUN bun install --dev --no-cache
RUN bun run build

# Stage 2: Runtime stage
FROM oven/bun:1.2-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 5000
CMD ["bun", "run", "dist/index.js"]
