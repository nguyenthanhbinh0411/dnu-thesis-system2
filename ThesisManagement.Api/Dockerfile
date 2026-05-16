# ============================================
# Multi-stage Dockerfile for ThesisManagement.Api
# ASP.NET Core 8 + Oracle EF Core
# ============================================

# ============================================
# Stage 1: Build
# ============================================
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src

# Copy project file and restore dependencies
COPY ThesisManagement.Api.csproj ./
RUN dotnet restore ThesisManagement.Api.csproj

# Copy all source code
COPY . ./

# Build in Release mode
RUN dotnet build ThesisManagement.Api.csproj -c Release --no-restore

# ============================================
# Stage 2: Publish
# ============================================
FROM build AS publish

WORKDIR /src

RUN dotnet publish ThesisManagement.Api.csproj \
    -c Release \
    --output /app/publish \
    -p:PublishSingleFile=false \
    -p:PublishReadyToRun=true \
    -p:PublishTrimmed=false

# ============================================
# Stage 3: Runtime
# ============================================
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime

# Install wget for healthcheck and bash for entrypoint script
RUN apt-get update && apt-get install -y wget bash && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd --gid 1000 appgroup && \
    useradd --uid 1000 --gid appgroup --shell /bin/bash appuser

WORKDIR /app

# Copy published files
COPY --from=publish /app/publish .

# Copy and set up entrypoint script for migrations
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Environment defaults
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080

# Expose internal port (not published to host)
EXPOSE 8080

# Healthcheck using wget (available in aspnet base image)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD wget -qO- http://localhost:8080/healthz || exit 1

# Entry point - runs migrations then starts the application
ENTRYPOINT ["/app/docker-entrypoint.sh"]
