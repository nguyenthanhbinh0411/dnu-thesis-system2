# ============================================
# Frontend Docker image for Thesis Management System
# ============================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY thesis-frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY thesis-frontend/. ./

# Build
ENV VITE_API_BASE_URL=/api
RUN npm run build

# ============================================
# Production stage with nginx
# ============================================
FROM nginx:alpine AS production

# Copy nginx config
COPY thesis-frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
