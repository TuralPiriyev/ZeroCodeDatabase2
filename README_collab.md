Quick README snippet for Yjs-based collaboration

ENV vars required:
- MONGO_URI (mongodb connection string)
- PORT (optional, defaults to 5000)

Run server:

```powershell
$env:MONGO_URI='mongodb://127.0.0.1:27017/zc_dev'; node server/index.cjs
```

Notes:
- Server exposes Socket.IO at path `/ws/replicate` and REST snapshot endpoints under `/api/workspaces/:id/...`.
- The client helper `client/services/collab.cjs` demonstrates how to create a Yjs doc, join a workspace and send/receive updates.
