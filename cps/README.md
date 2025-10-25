# Connection Provisioning Service (CPS)

This folder implements a minimal Connection Provisioning Service (CPS) to provision per-app per-user DB credentials for MySQL and MongoDB, store metadata encrypted, and return one-time connection strings and client snippets.

Environment variables (see `.env.example`):

- ADMIN_API_KEY - token to authenticate admin UI and API calls
- MASTER_ENCRYPTION_KEY - base64 (or hex) encoded 32-byte key used for AES-256-GCM encryption
- PORT - service port (default 4000)

Quick start (dev):

1. cd cps
2. npm install
3. copy `.env.example` to `.env` and set values
4. npm run dev

The admin UI is available at `/cps/frontend/index.html` (static file served from your outer app or open the file directly and point to the CPS server with the API key). For demo, open the file and input ADMIN_API_KEY when prompted.

Endpoints (authenticated via X-API-KEY header):

- POST /api/databases — { name, type, host, port, adminUri }
- GET /api/databases
- POST /api/databases/:dbId/provision-user — { usernamePrefix, roles?, ttl? }
- POST /api/databases/:dbId/revoke-user — { username }
- POST /api/databases/:dbId/rotate-user — { username }

See `manual_test_plan.md` for step-by-step manual testing and example curl commands.

KMS and key management
----------------------

This service expects a 32-byte master encryption key to encrypt stored credentials. For development you can set `MASTER_ENCRYPTION_KEY` in `.env`. For production you should retrieve the key from a Key Management Service (KMS) such as AWS KMS, Google KMS, Azure Key Vault, or HashiCorp Vault.

The code includes a light-weight abstraction at `src/utils/kms.ts`. Replace the stubbed logic with a real KMS client that returns a 32-byte key buffer. The crypto helpers validate key length and will fail-fast if misconfigured.

Snippets and downloads
----------------------

The admin UI provides a download button for a PHP `MyDB` PDO-like wrapper under `/cps/snippets/mydb.php`. The server serves snippets under `/cps/snippets`.

Security notes
--------------

- Do NOT commit `.env` or any real admin credentials to git. Use environment variables or secure secrets in CI.
- `MASTER_ENCRYPTION_KEY` must remain secret; rotate it via your KMS and follow your provider's key rotation guidance.
- Admin API access must be protected (use ADMIN_API_KEY or the forthcoming JWT-based auth in future branches).

