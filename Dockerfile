# Student ERP System - Dockerfile
# Multi-stage build for production optimization

# Stage 1: Base
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++ libc6-compat

# Stage 2: Dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 3: Development dependencies (for build)
FROM base AS dev-deps
COPY package*.json ./
RUN npm ci && \
    npm cache clean --force

# Stage 4: Builder
FROM dev-deps AS builder
COPY . .
# Add any build steps here (e.g., TypeScript compilation, asset bundling)
# RUN npm run build

# Stage 5: Production
FROM node:20-alpine AS production
WORKDIR /app

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY --chown=expressjs:nodejs . .

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Switch to non-root user
USER expressjs

# Start the application
CMD ["node", "backend/server.js"]

# Labels for container metadata
LABEL maintainer="Student ERP Team"
LABEL version="1.0.0"
LABEL description="ERP-based Integrated Student Management System"
