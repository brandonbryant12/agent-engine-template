# Linux Deployment Guide

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Git
- UFW (Uncomplicated Firewall)

## Quick Start

```bash
# Clone and enter the project
git clone <repo-url> template-app
cd template-app

# Get your LAN IP
HOST_IP=$(hostname -I | awk '{print $1}')

# Start everything
HOST_IP=$HOST_IP docker compose up --build -d
```

## Services

| Service        | Port | URL                          |
| -------------- | ---- | ---------------------------- |
| Web app        | 8086 | `http://<HOST_IP>:8086`      |
| API server     | 3036 | `http://<HOST_IP>:3036`      |
| Worker         | -    | Internal background processor |
| Redis          | -    | Internal pub/sub service      |
| MinIO S3 API   | 9001 | `http://<HOST_IP>:9001`      |
| MinIO Console  | 9090 | `http://<HOST_IP>:9090`      |
| PostgreSQL     | 5432 | `postgres://localhost:5432`   |

## UFW Firewall Setup

```bash
# Enable UFW if not already active
sudo ufw enable

# Allow SSH (do this first so you don't lock yourself out)
sudo ufw allow 22/tcp

# Allow web app
sudo ufw allow 8086/tcp

# Allow API server
sudo ufw allow 3036/tcp

# Allow MinIO S3 API (needed for browser access to stored files)
sudo ufw allow 9001/tcp

# Allow MinIO Console (optional — admin UI)
sudo ufw allow 9090/tcp

# Verify rules
sudo ufw status numbered
```

To restrict access to a specific subnet (e.g. your LAN only):

```bash
sudo ufw allow from 192.168.1.0/24 to any port 8086
sudo ufw allow from 192.168.1.0/24 to any port 3036
sudo ufw allow from 192.168.1.0/24 to any port 9001
sudo ufw allow from 192.168.1.0/24 to any port 9090
```

**Do not expose port 5432 (PostgreSQL)** unless you have a specific need. It is only used internally by Docker services.

## Environment Variables

Set these before `docker compose up` or place them in a `.env` file at the project root:

| Variable            | Default                                   | Description                          |
| ------------------- | ----------------------------------------- | ------------------------------------ |
| `HOST_IP`           | `localhost`                               | LAN IP or domain for public URLs     |
| `SERVER_AUTH_SECRET` | `please_change_this_in_production`        | Auth session secret — **change this** |
| `USE_MOCK_AI`       | `true`                                    | Set `false` + provide API key for real AI |
| `GEMINI_API_KEY`    | *(empty)*                                 | Required when `USE_MOCK_AI=false`    |

Example `.env` file at project root:

```env
HOST_IP=192.168.1.50
SERVER_AUTH_SECRET=your-secure-random-string
USE_MOCK_AI=true
```

## Storage

MinIO provides S3-compatible object storage. The compose setup:

- Runs the S3 API on port **9001** and console on **9090**
- Auto-creates a `template-app` bucket with public anonymous access
- The API server uploads to MinIO internally via `http://minio:9001`
- URLs returned to the browser use `http://<HOST_IP>:9001/template-app/<key>`

Default credentials (MinIO Console at `http://<HOST_IP>:9090`):

- **Username:** `minioadmin`
- **Password:** `minioadmin`

## CORS

The server is configured with `CORS_ORIGINS=*` (permissive) in Docker mode. This reflects any requesting origin, allowing the web app, MinIO, and any other client to communicate without CORS errors.

To restrict CORS to specific origins, set a comma-separated list:

```env
CORS_ORIGINS=http://192.168.1.50:8086,http://mydomain.com
```

## Common Operations

```bash
# View logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f server
docker compose logs -f worker

# Restart a single service
docker compose restart server

# Rebuild and restart
HOST_IP=$HOST_IP docker compose up --build -d

# Stop everything
docker compose down

# Stop and remove volumes (full reset)
docker compose down -v

# Check service health
docker compose ps
```

## Troubleshooting

**Storage URLs return `http://minio:9001/...` (unreachable from browser)**
- Ensure `HOST_IP` is set to your machine's LAN IP, not `localhost` or `127.0.0.1`

**CORS errors in browser console**
- Verify `CORS_ORIGINS=*` is set in the server environment
- Check that `PUBLIC_WEB_URL` matches the URL you're accessing the web app from

**MinIO uploads fail with 403**
- The `minio-init` service should have set the bucket policy to public. Check its logs:
  `docker compose logs minio-init`

**Web app can't reach the API**
- Ensure port 3036 is open in UFW
- Check that `PUBLIC_SERVER_URL` in the web service matches `http://<HOST_IP>:3036`
