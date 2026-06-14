FROM node:20-slim

# Install pnpm
RUN npm install -g pnpm@11

WORKDIR /app

# Copy entire project (see .dockerignore for exclusions)
COPY . .

# Install all dependencies
# --ignore-scripts bypasses the sh-based preinstall (Linux sh exists but we skip
# all lifecycle scripts; esbuild & oracledb work fine without their postinstall)
RUN pnpm install --ignore-scripts

# Build React frontend
# PORT satisfies vite.config.ts requirement; BASE_PATH=/ serves app at root
RUN PORT=8080 BASE_PATH=/ pnpm --filter @workspace/real-estate-app build

# Build Express backend (bundles to dist/index.mjs via esbuild)
RUN pnpm --filter @workspace/api-server build

EXPOSE 8080

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
