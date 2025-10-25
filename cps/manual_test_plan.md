# CPS Manual Test Plan

1. Setup
   - Create a `.env` based on `.env.example` and set `ADMIN_API_KEY` and `MASTER_ENCRYPTION_KEY` (base64 or hex for 32 bytes).
   - Start the CPS server: `npm run dev`

2. Add a MySQL database entry (example):

curl -X POST http://localhost:4000/api/databases -H "Content-Type: application/json" -H "x-api-key: $ADMIN_API_KEY" -d '{"name":"testdb","type":"mysql","host":"localhost","port":3306,"adminUri":"mysql://root:rootpass@localhost:3306"}'

3. Provision a user:

curl -X POST http://localhost:4000/api/databases/<dbId>/provision-user -H "Content-Type: application/json" -H "x-api-key: $ADMIN_API_KEY" -d '{"usernamePrefix":"app","ttl":3600}'

Response includes: connectionString, expiresAt, snippets (php/node/python). Use the connectionString in your client snippet.

4. Use PHP PDO snippet (MySQL):

<?php
$pdo = new PDO('mysql:host=HOST;port=PORT;dbname=testdb;charset=utf8mb4', 'username', 'password');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

Replace username/password/host/port with values from the connection string.

5. Revoke user

curl -X POST http://localhost:4000/api/databases/<dbId>/revoke-user -H "Content-Type: application/json" -H "x-api-key: $ADMIN_API_KEY" -d '{"username":"the_user"}'

6. Rotate (not fully implemented in this MVP — endpoint exists but server-side rotation to DB must be implemented):

curl -X POST http://localhost:4000/api/databases/<dbId>/rotate-user -H "Content-Type: application/json" -H "x-api-key: $ADMIN_API_KEY" -d '{"username":"the_user"}'

KMS and key validation
----------------------

1. Ensure `MASTER_ENCRYPTION_KEY` is set in `.env` (development) or that your KMS is returning a 32-byte key in production.
2. Start the server and verify it does not start if the key is invalid.

Snippet download
----------------
The frontend includes a download button for the PHP `MyDB` wrapper at `/cps/snippets/mydb.php`.

Audit export & metrics
----------------------
1. After running provision/rotate/revoke actions, call `GET /api/audit?dbId=<dbId>&limit=50` to list audit rows.
2. Export audit as CSV: `GET /api/audit/export?dbId=<dbId>&format=csv`
3. Metrics: `GET /api/metrics` returns counters for provisions/rotates/revokes.
