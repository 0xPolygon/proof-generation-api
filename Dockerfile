FROM node:20-bookworm-slim
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
