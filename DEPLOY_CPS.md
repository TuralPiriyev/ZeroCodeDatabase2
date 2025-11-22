# Deploying CPS integration (CPS_ADMIN_API_KEY + CPS_DEFAULT_DB_ID)

This document shows how to add the required environment variables so the main site can request per-user connection strings from your CPS admin API. After adding the env vars, restart/redeploy the service and verify `/api/cps/connection` returns a live provisioning response.

Required environment variables

- `CPS_ADMIN_API_KEY` — the server-side admin API key for your CPS admin API (keep secret).
- `CPS_DEFAULT_DB_ID` — the database ID that the CPS admin should provision for end users by default.
- Optional: `CPS_BASE_URL` — if your CPS admin is hosted on a different base URL than the site.

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
      - CPS_DEFAULT_DB_ID=default-db-id
      # - CPS_BASE_URL=https://cps.example.com
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
   - `CPS_DEFAULT_DB_ID` = default-db-id
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
  - Confirm you restarted/redeployed the service after setting env vars.
  - Check server logs for any errors contacting the CPS admin API.

- If `/api/cps/connection` returns an HTTP 500, check server logs — the frontend now handles errors quietly and will display a friendly message instead of printing server error bodies to the browser console.

---

If you want, I can add platform-specific sample `systemd` unit snippets, Kubernetes `Deployment` examples (with `envFrom` / `Secret`), or a small CI snippet to inject these secrets during deploy.
