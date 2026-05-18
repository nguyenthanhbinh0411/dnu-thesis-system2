#!/bin/bash
set -e

echo "=========================================="
echo "ThesisManagement.Api - Startup Script"
echo "=========================================="

if [ -n "${DB_HOST:-}" ] && [ -n "${DB_PORT:-}" ]; then
	echo "Waiting for database at ${DB_HOST}:${DB_PORT}..."
	for i in $(seq 1 60); do
		if (echo > /dev/tcp/${DB_HOST}/${DB_PORT}) >/dev/null 2>&1; then
			echo "Database is reachable."
			break
		fi

		if [ "$i" -eq 60 ]; then
			echo "Database is still unreachable after waiting."
			exit 1
		fi

		sleep 2
	done
fi

echo "Starting application..."
echo "=========================================="

# Start the application
exec dotnet ThesisManagement.Api.dll
