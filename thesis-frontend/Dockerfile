# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies using npm (package-lock.json exists)
RUN npm ci

# Copy source code
COPY . .

# Build arguments
ARG VITE_API_BASE_URL=/api

# Set build environment
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build the application
RUN npm run build

# ============================================
# Stage 2: Production (nginx)
# ============================================
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy main nginx.conf with worker_processes at main level
COPY nginx-main.conf /etc/nginx/nginx.conf

# Copy server-level config (without worker_processes)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Create nginx logs directory
RUN mkdir -p /var/log/nginx

# Expose port 80
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
