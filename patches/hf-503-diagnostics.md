## HF 5xx/503 Diagnostics and Resiliency tools

This patch adds diagnostics scripts, client/server retry utilities, a mock HF server for testing, pytest/jest tests, and CI workflow to help diagnose and mitigate 503/5xx errors when calling Hugging Face Inference endpoints.

Key additions:
- tools/diag-hf/* (diag.sh, diag.ps1, mock_hf_server.js, README)
- src/utils/hf-retry/* (postWithRetry.ts, axiosRetry.ts)
- server/utils/hfClient.js (server-side wrapper with keepalive + retry + circuit breaker)
- tests/hf and tests/py integration tests
- .github workflow to run the tests on push

Usage and reproduction steps are in `tools/diag-hf/README.md`.
