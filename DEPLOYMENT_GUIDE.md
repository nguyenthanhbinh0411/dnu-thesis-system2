# CI/CD Deployment Guide - Graduation Thesis Management System

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Security Model](#2-security-model)
3. [GitHub Configuration](#3-github-configuration)
4. [Server Setup](#4-server-setup)
5. [Environment Files](#5-environment-files)
6. [Deployment Workflow](#6-deployment-workflow)
7. [Post-Deploy Verification](#7-post-deploy-verification)
8. [Troubleshooting](#8-troubleshooting)
9. [Database Backup](#9-database-backup)

---

## 1. Architecture Overview

### System Components

| Component | Technology | Location | Port |
|-----------|------------|----------|------|
| Backend API | ASP.NET Core 8 | `ThesisManagement.Api/` | 8080 (internal) |
| Frontend Web | React + Vite | `thesis-frontend/` | 80 (nginx) |
| Database | Oracle External | N/A | N/A |
| Web Server | Nginx Alpine | Container | 8888 (public) |

### Network Architecture

```
Internet (port 8888)
        │
        ▼
┌───────────────────┐
│   Nginx (Frontend) │  :80
│   graduation-thesis-web │
└─────────┬─────────┘
          │ /api, /hubs
          ▼
┌───────────────────┐
│   ASP.NET Core    │  :8080 (internal only)
│   graduation-thesis-api │
└─────────┬─────────┘
          │ DB Connection
          ▼
    ┌───────────┐
    │  Oracle   │  (External - not in Docker)
    │  Database │
    └───────────┘
```

### Build Information

- **Backend DLL:** `ThesisManagement.Api.dll`
- **Frontend Build Output:** `dist/`
- **API Base URL Variable:** `VITE_API_BASE_URL`
- **Health Endpoint:** `/healthz`
- **SignalR Hubs:** `/hubs/chat`, `/hubs/notifications`, `/hubs/defense`

---

## 2. Security Model

### Critical Security Principles

> **WARNING: Runtime secrets MUST NOT be stored in GitHub Secrets or committed to GitHub.**

| Secret Type | Storage Location | GitHub? |
|-------------|-----------------|---------|
| DB_CONNECTION_STRING | Server: `/opt/graduation-thesis/.env.runtime` | NO |
| JWT_SECRET | Server: `/opt/graduation-thesis/.env.runtime` | NO |
| DB_PASSWORD | Server: `/opt/graduation-thesis/.env.runtime` | NO |
| SERVER_HOST | GitHub Secrets | YES |
| SERVER_USER | GitHub Secrets | YES |
| SERVER_SSH_PORT | GitHub Secrets | YES |
| SERVER_APP_DIR | GitHub Secrets | YES |
| PUBLIC_PORT | GitHub Secrets | YES |
| SERVER_SSH_KEY | GitHub Secrets | YES |

### Forbidden Actions

- DO NOT add `DB_CONNECTION_STRING` to GitHub Secrets
- DO NOT add `JWT_SECRET` to GitHub Secrets
- DO NOT add database passwords to GitHub
- DO NOT commit `.env.runtime` to GitHub
- DO NOT log `.env.runtime` contents in workflows
- DO NOT use `docker compose down -v` (deletes volumes)
- DO NOT delete database volumes

### Port Security

| Port | Service | Access | Notes |
|------|---------|--------|-------|
| 8888 | Frontend (nginx) | Public | HTTP only |
| 8080 | Backend API | Internal only | Not exposed to host |
| 1912 | SSH | Admin only | Server firewall |
| 5432 | Database | Internal only | Not exposed |

---

## 3. GitHub Configuration

> **IMPORTANT:** All deployment configuration has been moved from GitHub Variables to GitHub Secrets for easier management.

### GitHub Secrets (Settings → Secrets and variables → Actions → Secrets)

| Name | Value | Required |
|------|-------|----------|
| `SERVER_HOST` | `118.70.169.236` | Yes |
| `SERVER_USER` | `devfit` | Yes |
| `SERVER_SSH_PORT` | `1912` | Yes |
| `SERVER_APP_DIR` | `/opt/graduation-thesis` | Yes |
| `PUBLIC_PORT` | `8888` | Yes |
| `SERVER_SSH_KEY` | Private key content | Yes |

### How to Add Secrets

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add each secret from the table above

### NOT Required (Security)

The following are NOT needed in GitHub and must NOT be added:

- ~~`DB_CONNECTION_STRING`~~ - Stored on server only in `.env.runtime`
- ~~`JWT_SECRET`~~ - Stored on server only in `.env.runtime`
- ~~`DB_PASSWORD`~~ - Stored on server only in `.env.runtime`
- ~~`SERVER_SSH_KNOWN_HOSTS`~~ - Workflow generates dynamically via ssh-keyscan

---

## 4. Server Setup

### Prerequisites Check

SSH to your server:

```bash
ssh -p 1912 devfit@118.70.169.236
```

### 1. Create Deployment Directory

```bash
# Create directory
sudo mkdir -p /opt/graduation-thesis
sudo chown -R devfit:devfit /opt/graduation-thesis

# Create subdirectories
mkdir -p /opt/graduation-thesis/images

# Verify
ls -la /opt/graduation-thesis/
```

### 2. Verify Docker Installation

```bash
# Check Docker version
docker --version
# Expected: Docker version 24.x.x or higher

# Check Docker Compose version
docker compose version
# Expected: Docker Compose version v2.x.x or higher

# Verify Docker daemon
docker info | head -5
```

### 3. Open Firewall Port

```bash
# Check current firewall status
sudo ufw status

# Open port 8888 (frontend)
sudo ufw allow 8888/tcp

# Reload firewall
sudo ufw reload

# Verify port is open
sudo ufw status | grep 8888
```

### 4. Verify Port Availability

```bash
# Check if port 8888 is free
ss -tulpn | grep :8888

# Expected output: (empty if port is free)
# If occupied, stop the existing service first
```

### 5. Test SSH Connection

```bash
# Test basic SSH
ssh -p 1912 devfit@118.70.169.236 "echo 'SSH OK'"

# Test with verbose output (first time only)
ssh -v -p 1912 devfit@118.70.169.236 "echo 'SSH OK'"
```

---

## 5. Environment Files

### Directory Structure on Server

```
/opt/graduation-thesis/
├── .env.runtime          # Secrets (DB, JWT) - NEVER commit
├── .deploy.env           # Non-sensitive config (auto-generated)
├── .env                  # Merged (auto-generated)
├── docker-compose.production.yml
└── images/
    ├── backend-image-{sha}.tar.gz
    └── frontend-image-{sha}.tar.gz
```

### Create .env.runtime

This is the **ONLY** place where secrets are stored.

```bash
nano /opt/graduation-thesis/.env.runtime
```

#### Template for Oracle External Database

```bash
# =============================================
# Runtime Environment Variables
# Graduation Thesis Management System
# =============================================
# SECURITY WARNING: This file contains sensitive data.
# DO NOT commit to GitHub.
# =============================================

# ASP.NET Core Environment
ASPNETCORE_ENVIRONMENT=Production

# Database Connection String (Oracle)
# Format: User Id=USER;Password=PASS;Data Source=HOST:PORT/SERVICE;
DB_CONNECTION_STRING=User Id=YOUR_DB_USER;Password=YOUR_DB_PASSWORD;Data Source=your-oracle-host:1521/your-service-name;

# JWT Configuration
JWT_SECRET=YourSuperSecretKeyThatIsAtLeast32CharactersLong123!
JWT_ISSUER=ThesisManagement.Api
JWT_AUDIENCE=ThesisManagement.Client
JWT_EXPIRY_MINUTES=60

# Mega.nz API (optional)
MEGA_API_KEY=
```

### Secure .env.runtime

```bash
# Set proper permissions
chmod 600 /opt/graduation-thesis/.env.runtime
chown devfit:devfit /opt/graduation-thesis/.env.runtime

# Verify
ls -la /opt/graduation-thesis/.env.runtime
```

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ASPNETCORE_ENVIRONMENT` | Yes | Set to `Production` |
| `DB_CONNECTION_STRING` | Yes | Oracle connection string |
| `JWT_SECRET` | Yes | JWT signing key (32+ chars) |
| `JWT_ISSUER` | No | JWT issuer (default: ThesisManagement.Api) |
| `JWT_AUDIENCE` | No | JWT audience (default: ThesisManagement.Client) |
| `JWT_EXPIRY_MINUTES` | No | Token expiry (default: 60) |
| `MEGA_API_KEY` | No | Mega.nz API key (optional) |

---

## 6. Deployment Workflow

### Automatic Deployment (Push to main)

```bash
# Push to main triggers automatic deployment
git push origin main
```

### Manual Deployment (workflow_dispatch)

1. Go to GitHub → Actions
2. Select "Deploy to Production"
3. Click "Run workflow"
4. Optionally skip frontend/backend build

### Deployment Flow

```
┌─────────────┐    Push to     ┌─────────────────┐
│   Source    │───  main    ──▶│ GitHub Actions  │
│   Code      │               │                 │
└─────────────┘               └────────┬────────┘
                                      │
                          ┌───────────┴───────────┐
                          ▼                       ▼
                    ┌──────────┐            ┌──────────┐
                    │  Build  │            │  Build   │
                    │ Backend │            │ Frontend │
                    │  (DLL)  │            │  (dist)  │
                    └────┬─────┘            └────┬─────┘
                          │                      │
                          └──────────┬───────────┘
                                     ▼
                          ┌──────────────────┐
                          │ Build Docker      │
                          │ Images           │
                          │ graduation-thesis │
                          │ -api:{sha}       │
                          │ -web:{sha}       │
                          └────────┬─────────┘
                                   │
                          ┌────────┴────────┐
                          ▼                 ▼
                    ┌──────────┐      ┌──────────┐
                    │  Save   │      │  Upload  │
                    │  .tar.gz│─────▶│ via SCP │
                    └──────────┘      └────┬─────┘
                                           │
                          ┌─────────────────┴─────────────────┐
                          ▼                                   ▼
                    ┌──────────┐                       ┌──────────┐
                    │  Load   │                       │ Verify   │
                    │ Images  │                       │ .env.    │
                    └────┬─────┘                       │ runtime  │
                         │                             └────┬─────┘
                         └────────────┬──────────────────────┘
                                      ▼
                          ┌─────────────────────┐
                          │ Merge .deploy.env   │
                          │ + .env.runtime      │
                          │ = .env              │
                          └──────────┬──────────┘
                                     │
                          ┌──────────┴──────────┐
                          ▼                     ▼
                    ┌──────────┐         ┌──────────┐
                    │ Deploy  │────────▶│ Health   │
                    │ Services│         │ Check   │
                    └──────────┘         └──────────┘
```

---

## 7. Post-Deploy Verification

### Check Running Containers

```bash
ssh -p 1912 devfit@118.70.169.236 "docker ps -a"
```

Expected output:
```
CONTAINER ID   IMAGE                              STATUS
abc123def456   graduation-thesis-api:{sha}   Up 2 minutes
xyz789ghi012   graduation-thesis-web:{sha}    Up 2 minutes
```

### Check Backend Logs

```bash
ssh -p 1912 devfit@118.70.169.236 "docker logs graduation-thesis-api --tail 100"
```

### Check Frontend Logs

```bash
ssh -p 1912 devfit@118.70.169.236 "docker logs graduation-thesis-web --tail 50"
```

### Test HTTP Endpoints

```bash
# Test frontend (nginx)
ssh -p 1912 devfit@118.70.169.236 "curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:8888/"

# Test backend health (internal)
ssh -p 1912 devfit@118.70.169.236 "docker exec graduation-thesis-api wget -qO- http://localhost:8080/healthz"

# Test API proxy
ssh -p 1912 devfit@118.70.169.236 "curl -fsS http://127.0.0.1:8888/api/"
```

### Verify Listening Ports

```bash
ssh -p 1912 devfit@118.70.169.236 "ss -tulpn | grep -E ':(8888|8080)'"
```

Expected output:
```
tcp   LISTEN   0.511   0.0.0.0:8888   0.0.0.0:*   nginx/graduation-thesis-web
tcp   LISTEN   0.128   172.28.0.2:8080   0.0.0.0:*   dotnet/ThesisManagement.Api
```

---

## 8. Troubleshooting

### Error 1: SSH Connection Failed

**Symptom:**
```
Error: ssh: connect to host 118.70.169.236 port 1912: Connection refused
```

**Diagnosis:**
```bash
# Check if SSH service is running
ssh -p 1912 devfit@118.70.169.236 "sudo systemctl status sshd"

# Check if port is open
sudo ss -tulpn | grep :1912
```

**Fix:**
```bash
# Start SSH service
sudo systemctl start sshd
sudo systemctl enable sshd

# Check firewall
sudo ufw status
sudo ufw allow 1912/tcp
```

---

### Error 2: .env.runtime Not Found

**Symptom:**
```
Error: Missing /opt/graduation-thesis/.env.runtime on server.
```

**Diagnosis:**
```bash
ssh -p 1912 devfit@118.70.169.236 "ls -la /opt/graduation-thesis/.env.runtime"
```

**Fix:**
```bash
# Create .env.runtime on server
ssh -p 1912 devfit@118.70.169.236 "nano /opt/graduation-thesis/.env.runtime"

# Set permissions
ssh -p 1912 devfit@118.70.169.236 "chmod 600 /opt/graduation-thesis/.env.runtime"
```

---

### Error 3: Docker Permission Denied

**Symptom:**
```
Permission denied while trying to connect to the Docker daemon socket
```

**Diagnosis:**
```bash
ssh -p 1912 devfit@118.70.169.236 "groups devfit"
ssh -p 1912 devfit@118.70.169.236 "id devfit"
```

**Fix:**
```bash
# Add user to docker group
ssh -p 1912 devfit@118.70.169.236 "sudo usermod -aG docker devfit"

# Re-login required
exit
ssh -p 1912 devfit@118.70.169.236
```

---

### Error 4: Port 8888 Already in Use

**Symptom:**
```
Error starting userland proxy: listen tcp4 0.0.0.0:8888: bind: address already in use
```

**Diagnosis:**
```bash
ssh -p 1912 devfit@118.70.169.236 "ss -tulpn | grep :8888"
```

**Fix:**
```bash
# Find and stop the process using port 8888
ssh -p 1912 devfit@118.70.169.236 "sudo lsof -i :8888"

# Or stop the existing container
ssh -p 1912 devfit@118.70.169.236 "docker stop graduation-thesis-web"
ssh -p 1912 devfit@118.70.169.236 "docker rm graduation-thesis-web"
```

---

### Error 5: Backend Container Exited

**Symptom:**
```
docker ps -a | grep api
# graduation-thesis-api   Exited (139)
```

**Diagnosis:**
```bash
ssh -p 1912 devfit@118.70.169.236 "docker logs graduation-thesis-api"
```

**Common Causes:**

1. **Missing DB_CONNECTION_STRING:**
```bash
ssh -p 1912 devfit@118.70.169.236 "grep DB_CONNECTION_STRING /opt/graduation-thesis/.env"
```

2. **Invalid connection string:**
```bash
ssh -p 1912 devfit@118.70.169.236 "grep DB_CONNECTION_STRING /opt/graduation-thesis/.env.runtime"
```

3. **Oracle database unreachable:**
```bash
ssh -p 1912 devfit@118.70.169.236 "docker exec graduation-thesis-api ping -c 3 oracle-host"
```

---

### Error 6: Backend Cannot Connect to Database

**Symptom:**
```
fail: Microsoft.EntityFrameworkCore.Database.Connection[20002]
OracleException: ORA-12154: TNS:could not resolve...
```

**Diagnosis:**
```bash
# Check connection string format
ssh -p 1912 devfit@118.70.169.236 "grep DB_CONNECTION_STRING /opt/graduation-thesis/.env.runtime"

# Test network connectivity
ssh -p 1912 devfit@118.70.169.236 "docker exec graduation-thesis-api nslookup oracle-host"
```

**Fix:**
1. Verify Oracle host is accessible
2. Check Oracle service name
3. Verify firewall allows connection to Oracle port (1521)

---

### Error 7: Frontend 502 Bad Gateway

**Symptom:**
```
502 Bad Gateway
nginx
```

**Diagnosis:**
```bash
# Check backend is running
ssh -p 1912 devfit@118.70.169.236 "docker ps | grep backend"

# Check backend health
ssh -p 1912 devfit@118.70.169.236 "docker exec graduation-thesis-api wget -qO- http://localhost:8080/healthz"

# Check nginx logs
ssh -p 1912 devfit@118.70.169.236 "docker logs graduation-thesis-web --tail 20"
```

**Fix:**
```bash
# Restart backend
ssh -p 1912 devfit@118.70.169.236 "docker restart graduation-thesis-api"

# Wait and check
sleep 30
ssh -p 1912 devfit@118.70.169.236 "docker exec graduation-thesis-api wget -qO- http://localhost:8080/healthz"
```

---

### Error 8: API /api Not Proxying

**Symptom:**
```
404 Not Found
/api/...
```

**Diagnosis:**
```bash
# Check nginx config
ssh -p 1912 devfit@118.70.169.236 "docker exec graduation-thesis-web cat /etc/nginx/conf.d/default.conf | grep -A10 'location /api'"

# Check backend is accessible from nginx container
ssh -p 1912 devfit@118.70.169.236 "docker exec graduation-thesis-web ping -c 3 graduation-thesis-api"
```

**Fix:**
```bash
# Restart frontend
ssh -p 1912 devfit@118.70.169.236 "docker restart graduation-thesis-web"

# Verify network
ssh -p 1912 devfit@118.70.169.236 "docker network inspect graduation-thesis-net"
```

---

### Error 9: Healthcheck Failed

**Symptom:**
```
Container graduation-thesis-api health check exceeded timeout
```

**Diagnosis:**
```bash
# Check if health endpoint is accessible
ssh -p 1912 devfit@118.70.169.236 "docker exec graduation-thesis-api wget -qO- http://localhost:8080/healthz"

# Check container startup logs
ssh -p 1912 devfit@118.70.169.236 "docker logs graduation-thesis-api --tail 200"
```

**Fix:**
```bash
# Increase start_period in docker-compose if needed
# Or check if application needs more time to start
# Restart container
ssh -p 1912 devfit@118.70.169.236 "docker restart graduation-thesis-api"
```

---

## 9. Database Backup

> **IMPORTANT: Always backup database before any deployment that might affect schema.**

### Backup Oracle Database

```bash
# SSH to server
ssh -p 1912 devfit@118.70.169.236

# Create backup directory
mkdir -p /opt/graduation-thesis/backups

# Backup command (adjust based on your Oracle setup)
# Option 1: Data Pump export
expdp USER/PASSWORD@ORCL full=Y directory=DUMP_DIR dumpfile=backup_$(date +%Y%m%d_%H%M%S).dmp logfile=backup_$(date +%Y%m%d_%H%M%S).log

# Option 2: RMAN backup (if configured)
rman target / @"
RUN {
  BACKUP DATABASE FORMAT '/opt/graduation-thesis/backups/db_%T_%s.bak';
}
"

# Option 3: Create checkpoint script
cat > /opt/graduation-thesis/backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/graduation-thesis/backups
mkdir -p $BACKUP_DIR

# Your Oracle backup command here
# Example with expdp:
# expdp USER/PASSWORD@ORCL directory=DATA_PUMP_DIR dumpfile=thesis_backup_$DATE.dmp

echo "Backup completed: $DATE"
ls -lh $BACKUP_DIR
EOF

chmod +x /opt/graduation-thesis/backup-db.sh
```

### Restore Database (if needed)

```bash
# SSH to server
ssh -p 1912 devfit@118.70.169.236

# Restore command (adjust based on your Oracle setup)
# Option 1: Data Pump import
impdp USER/PASSWORD@ORCL full=Y directory=DUMP_DIR dumpfile=backup_FILE.dmp logfile=import.log

# Option 2: Stop app, restore, start app
cd /opt/graduation-thesis
docker compose -f docker-compose.production.yml down
# Run restore...
docker compose -f docker-compose.production.yml up -d
```

---

## Quick Reference Commands

### Connect to Server
```bash
ssh -p 1912 devfit@118.70.169.236
```

### Check Status
```bash
docker ps -a | grep graduation
```

### View Logs
```bash
docker logs graduation-thesis-api --tail 100 -f
docker logs graduation-thesis-web --tail 50 -f
```

### Restart Services
```bash
docker restart graduation-thesis-api graduation-thesis-web
```

### Full Redeploy (manual)
```bash
cd /opt/graduation-thesis
docker compose --env-file .env -f docker-compose.production.yml down
docker compose --env-file .env -f docker-compose.production.yml up -d
```

### Healthcheck
```bash
curl http://127.0.0.1:8888/
curl http://127.0.0.1:8888/api/
docker exec graduation-thesis-api wget -qO- http://localhost:8080/healthz
```

### Backup Before Deploy
```bash
# Create backup
/opt/graduation-thesis/backup-db.sh

# Or manual snapshot
cp /opt/graduation-thesis/.env /opt/graduation-thesis/.env.backup.$(date +%Y%m%d)
```

---

## Security Checklist

Before deployment, verify:

- [ ] `.env.runtime` exists on server
- [ ] `.env.runtime` has correct permissions (600)
- [ ] No secrets in GitHub Secrets
- [ ] SSH key has correct permissions (600)
- [ ] Port 8888 is open in firewall
- [ ] Database is accessible from server
- [ ] Backup completed (for schema changes)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-16 | Initial CI/CD with security model |
