# Stage 1: Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy monorepo root settings
COPY package.json yarn.lock* turbo.json tsconfig.json ./

# Copy individual package configurations for dependency installation caching
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/utils/package.json ./packages/utils/
COPY packages/constants/package.json ./packages/constants/

# Install workspace dependencies
RUN yarn install

# Copy source code files
COPY . .

# Set build-time env variables for Next.js build
ARG NEXT_PRIVATE_API_URL
ENV NEXT_PRIVATE_API_URL=$NEXT_PRIVATE_API_URL

ARG NEXT_PUBLIC_MINIO_URL
ENV NEXT_PUBLIC_MINIO_URL=$NEXT_PUBLIC_MINIO_URL

# Compile workspace and build Next.js Web application using Turborepo
RUN npx turbo run build --filter=web

# Stage 2: Production runner stage
FROM node:20-slim AS runner

WORKDIR /app

# Copy compiled build artifact assets from builder stage
COPY --from=builder /app ./

# Expose default Next.js web server port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run Next.js workspace server
CMD ["yarn", "workspace", "web", "start"]
