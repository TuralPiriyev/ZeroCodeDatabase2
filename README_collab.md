Quick README snippet for Yjs-based collaboration

ENV vars required:
- MONGO_URI (mongodb connection string)
- PORT (optional, defaults to 5000)

Additional env vars (AI proxy):
- HF_KEY (preferred) - your Hugging Face API key. Example in `.env.example`.
- ZEROCODEDB_API_KEY (deprecated alias) - still recognized for backward compatibility.

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
