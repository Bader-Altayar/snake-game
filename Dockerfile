FROM node:20-alpine

WORKDIR /app

# Install dependencies first so this layer is cached unless package*.json changes.
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY schema.sql ./schema.sql

ENV NODE_ENV=production
EXPOSE 3000

# Run as a non-root user -- if the app is ever compromised, the attacker
# doesn't get root inside the container.
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

CMD ["node", "src/server.js"]
