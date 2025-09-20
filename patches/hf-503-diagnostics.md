## HF 5xx/503 Diagnostics and Resiliency tools

This patch adds diagnostics scripts and resiliency helpers to help diagnose and mitigate 503/5xx errors when calling Hugging Face Inference endpoints. Mock/test artifacts were intentionally removed per repo cleanup request; remaining items are focused on production fixes and diagnostic scripts.

Key additions still present:
- tools/diag-hf/* (diag.sh, diag.ps1, README)
- src/utils/hf-retry/* (postWithRetry.ts, axiosRetry.ts)
- server/utils/hfClient.js (server-side wrapper with keepalive + retry + circuit breaker)

Usage and reproduction steps are in `tools/diag-hf/README.md`.
