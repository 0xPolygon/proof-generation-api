FROM node:20-bookworm-slim@sha256:b342de02eb4a57cd6986290a69833d20818508db8078dba0197a024193410aee
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
