#!/bin/bash
set -e

echo "=========================================="
echo "ThesisManagement.Api - Startup Script"
echo "=========================================="

# Run EF Core migrations
echo "Running database migrations..."
cd /app
dotnet ef database update --no-build --assembly ThesisManagement.Api.dll

if [ $? -eq 0 ]; then
    echo "Database migrations completed successfully."
else
    echo "Warning: Migration failed or database already up to date."
fi

echo "Starting application..."
echo "=========================================="

# Start the application
exec dotnet ThesisManagement.Api.dll
