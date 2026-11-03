# Cloud @1msg/mcp (Streamable HTTP)
#   docker build -t 1msg/1msg-mcp-http:local .
#   docker run --rm -p 3100:3100 -e ONE_MSG_BASE_URL=https://api.1msg.io 1msg/1msg-mcp-http:local

FROM node:24.22.2-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS build
WORKDIR /app
RUN npm install --global pnpm@10.34.9 --ignore-scripts --no-audit --no-fund
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm run build && pnpm prune --prod

FROM node:24.22.2-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85
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
