Quick README snippet for Yjs-based collaboration

ENV vars required:
- MONGO_URI (mongodb connection string)
- PORT (optional, defaults to 5000)

Additional env vars (AI proxy):
- MYSTER_API_KEY - your MysterAI API key. Example in `.env.example`.
- MYSTER_API_BASE_URL - optional base URL for MysterAI (defaults to https://api.myster.example).
- HF_KEY (deprecated) - legacy Hugging Face key kept for backward compatibility.

Local proxy & debug
-------------------

This project serves a small runtime helper and a server-side proxy to avoid exposing HF/OpenAI tokens in the browser.

Run locally:

1. Set Myster key (server only):

```powershell
$env:MYSTER_API_KEY = 'sk_xxx'
node server.cjs
```

2. Test the proxy (diagnostic script):

On Windows PowerShell:

```powershell
bash tools/diag/proxy-test.sh
```

Notes:
- Do NOT put `MYSTER_API_KEY` (or HF_TOKEN) in client-side code. The proxy attaches Authorization server-side.
- Consider adding rate-limiting and circuit-breaker for production.


Run server:

```powershell
$env:MONGO_URI='mongodb://127.0.0.1:27017/zc_dev'; node server/index.cjs
```

Quick proxy test (once server is running locally):

```powershell
# Replace host/port if your server runs on a different port
curl -i -X POST http://localhost:5000/api/proxy/dbquery -H "Content-Type: application/json" -d '{"query":"test"}'
```

Notes:
- Server exposes Socket.IO at path `/ws/replicate` and REST snapshot endpoints under `/api/workspaces/:id/...`.
- The client helper `client/services/collab.cjs` demonstrates how to create a Yjs doc, join a workspace and send/receive updates.
