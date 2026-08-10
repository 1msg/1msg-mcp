# Hosted @1msg/mcp (Streamable HTTP)
#   docker build -t 1msg/1msg-mcp-http:local .
#   docker run --rm -p 3100:3100 -e ONE_MSG_BASE_URL=https://api.stage.1msg.io 1msg/1msg-mcp-http:local

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV MCP_HTTP_HOST=0.0.0.0
ENV MCP_HTTP_PORT=3100
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3100
USER node
CMD ["node", "dist/http.js"]
