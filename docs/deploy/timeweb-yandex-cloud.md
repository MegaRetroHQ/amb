# AMB deployment on Timeweb Cloud and Yandex Cloud

This runbook uses one deployment topology for both providers:

- `amb.megaretro.ru` -> AMB dashboard (`web`)
- `api.amb.megaretro.ru` -> Nest API (`api`)
- managed PostgreSQL outside the app containers
- Caddy for TLS and reverse proxy

## Why this topology

Use a VM, not Timeweb App Platform, for this setup.

Timeweb currently states that in App Platform with Docker Compose:

- `80` and `443` host ports are reserved
- only the first service in `docker-compose.yml` is proxied by default
- other services are reachable only with explicit ports

Source: Timeweb Cloud docs, "Деплой из Docker Compose", accessed April 2, 2026:
https://timeweb.cloud/docs/apps/deploying-with-docker-compose

That conflicts with the target layout where both:

- `amb.megaretro.ru`
- `api.amb.megaretro.ru`

must work cleanly over HTTPS without exposing raw ports.

For Timeweb Cloud servers, root access is available on the VM.
Source: Timeweb Cloud docs, "Облачные серверы Timeweb Cloud", accessed April 2, 2026:
https://timeweb.cloud/docs/cloud-servers

For Yandex Cloud, Docker Compose deployment on a VM is also supported.
Source: Yandex Cloud docs, "Creating a VM from a Container Optimized Image with multiple Docker containers", updated June 9, 2025:
https://yandex.cloud/en/docs/cos/tutorials/docker-compose

## Files added in this repo

- `deploy/compose/docker-compose.hosting.yml`
- `deploy/compose/.env.hosting.example`
- `deploy/compose/Caddyfile`
- `scripts/deploy/hosting-deploy.sh`

## Environment file

On the server:

```bash
cp deploy/compose/.env.hosting.example deploy/compose/.env.hosting
```

Then edit:

```dotenv
WEB_DOMAIN=amb.megaretro.ru
API_DOMAIN=api.amb.megaretro.ru
DATABASE_URL=postgresql://amb_user:password@db-host:6432/amb?sslmode=require
JWT_SECRET=<long-random-secret>
AMB_BOOTSTRAP=true
```

Notes:

- Keep `AMB_BOOTSTRAP=true` on first deploy so the default admin and default project are created.
- After the first successful login, you can set `AMB_BOOTSTRAP=false`.
- If the managed PostgreSQL instance does not require TLS, remove `?sslmode=require`.

## DNS

Create or verify these records:

- `amb.megaretro.ru` -> A record to the VM public IP
- `api.amb.megaretro.ru` -> A record to the same VM public IP

If DNS was just changed, wait for propagation before requesting certificates.

## Timeweb Cloud

Recommended target:

1. Create a Cloud Server with Ubuntu 24.04 LTS.
2. Open inbound ports `22`, `80`, and `443`.
3. Point both subdomains to the server IP.
4. Install Docker Engine and Docker Compose plugin.
5. Clone this repo on the server.
6. Fill `deploy/compose/.env.hosting`.
7. Run the deploy script.

Server bootstrap:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
newgrp docker
```

Deploy:

```bash
git clone <your-repo-url> amb-app
cd amb-app
cp deploy/compose/.env.hosting.example deploy/compose/.env.hosting
$EDITOR deploy/compose/.env.hosting
sh scripts/deploy/hosting-deploy.sh
```

Verify:

```bash
curl -I https://amb.megaretro.ru
curl https://api.amb.megaretro.ru/api/health
```

Login:

- email: `admin@local.test`
- password: `ChangeMe123!`

Change the password immediately after first login.

## Yandex Cloud

Two workable options:

1. Standard Ubuntu VM in Compute Cloud, then use the same steps as Timeweb.
2. Container Optimized Image VM with Docker Compose.

For the quickest and most maintainable setup, I recommend the standard Ubuntu VM because:

- SSH administration is simpler
- updating files and Caddy config is straightforward
- the exact same runbook matches Timeweb

Minimum network rules:

- TCP `22` from your IP
- TCP `80` from `0.0.0.0/0`
- TCP `443` from `0.0.0.0/0`

If you prefer Yandex Container Optimized Image, Yandex documents `yc compute instance create-with-container` with a Docker Compose file. In that case, use `deploy/compose/docker-compose.hosting.yml` as the base manifest and provide the env file on the VM.

## Managed PostgreSQL

I still need these DB values from you before the final deploy:

- hostname
- port
- database name
- username
- password
- whether TLS is required
- whether provider-side IP allowlisting is enabled

## Operational notes

- The deployment uses published images from Docker Hub:
  - `openaisdk/amb-api:latest`
  - `openaisdk/amb-web-ui:latest`
- TLS is issued automatically by Caddy via Let's Encrypt after DNS starts resolving to the VM.
- API stays internal on the Docker network; only Caddy binds public ports.
- To update later:

```bash
cd amb-app
git pull
sh scripts/deploy/hosting-deploy.sh
```

## What I still need from you

To complete the real deployment, send:

1. Which provider you want first: `Timeweb Cloud VM` or `Yandex Cloud VM`.
2. SSH access method or server IP if the VM already exists.
3. PostgreSQL connection details.
4. Whether DNS for both subdomains already points to the target server IP.
