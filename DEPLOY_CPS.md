# Deploying CPS integration (CPS_ADMIN_API_KEY + CPS_DEFAULT_DB_ID)

This document shows how to add the required environment variables so the main site can request per-user connection strings using the embedded CPS adapter. After adding the env vars and copying your `cps_metadata.db` file (generated via the CPS admin UI) into the app directory, restart/redeploy the service and verify `/api/cps/connection` returns a live provisioning response.

Required environment variables

- `CPS_ADMIN_API_KEY` — flag indicating CPS integration is configured (also re-used by the legacy admin UI). Falls back to `ADMIN_API_KEY` for local dev.
- `CPS_DEFAULT_DB_ID` — the database ID that the CPS admin should provision for end users by default. Set to `auto` to let the server pick the first configured DB from `cps_metadata.db`.

> **Note:** `cps_metadata.db` (or the path defined by `CPS_SQLITE_PATH`) must be deployed alongside the server so the adapter can read DB definitions and encrypted admin URIs. You can generate this file by running `npm run dev` inside the `cps/` folder locally, adding databases in the minimal admin UI, then copying the resulting SQLite file to your deploy artifact.

Important: set these on the server where `server.cjs` runs. Never embed the admin key into frontend bundles.

---

## Docker Compose

Add to the service in `docker-compose.yml` that runs your Node app (example shows `web` service):

```yaml
services:
  web:
    image: your-image:latest
    environment:
      - CPS_ADMIN_API_KEY=sk_live_XXXXXXXXXXXXXXXX
      - CPS_DEFAULT_DB_ID=default-db-id # or "auto"
    ports:
      - "3000:3000"
```

Apply changes and restart:

```powershell
docker-compose up -d --force-recreate
```

Verify:

```powershell
curl http://localhost:3000/api/cps/connection
```

You should receive a JSON object with `configured: true`, a `connectionString`, and `examples` fields.

---

## Render (Managed)

1. Open your service in the Render dashboard.
2. Go to `Environment` (or `Settings -> Environment`), add two environment variables:
  - `CPS_ADMIN_API_KEY` = your admin key
  - `CPS_DEFAULT_DB_ID` = default-db-id (or `auto` to let the app pick the first CPS DB)
3. Redeploy the service (Render will typically redeploy automatically when you update environment variables).

Verify with `curl` against your deployed URL:

```powershell
curl https://your-app.onrender.com/api/cps/connection
```

---

## Heroku

Set config vars via CLI:

```powershell
heroku config:set CPS_ADMIN_API_KEY=sk_live_XXXXXXXXXXXXXXXX CPS_DEFAULT_DB_ID=default-db-id --app your-heroku-app
heroku restart --app your-heroku-app
```

Verify:

```powershell
curl https://your-heroku-app.herokuapp.com/api/cps/connection
```

---

## Verification & Troubleshooting

- Expected success response (example):

```json
{
  "configured": true,
  "connectionString": "mysql://user:pw@host:3306/dbname?ssl=true",
  "examples": { "php_pdo_mysql": "...", "php_mongodb": "..." }
}
```

- If you still see the demo fallback message (`configured: false` or message containing "CPS not configured"), then:
  - Confirm the process received the env vars (check `docker exec` / process env or the platform UI).
  - Confirm you restarted/redeployed the service after setting env vars and shipping `cps_metadata.db` with the deploy artifact.
  - Ensure `cps_metadata.db` actually contains at least one database with encrypted admin credentials (use the CPS admin UI locally to add one, then redeploy the updated file).

- If `/api/cps/connection` returns an HTTP 500/502, check server logs for `CPS connection provisioning error` — the log will include the adapter's detailed message (e.g., unsupported DB type, unable to decrypt admin URI, missing metadata file).

---

If you want, I can add platform-specific sample `systemd` unit snippets, Kubernetes `Deployment` examples (with `envFrom` / `Secret`), or a small CI snippet to inject these secrets during deploy.
