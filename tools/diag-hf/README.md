# HF Inference Diagnostics & Resiliency Tools

This folder contains diagnostic scripts, a mock server, retry utilities, and tests to help investigate and fix 5xx/503/429 issues when calling Hugging Face Inference API.

Files added:
- diag.sh / diag.ps1 - simple diagnostic scripts (curl/Invoke-RestMethod)
- mock_hf_server.js - Express mock server simulating 200/429/503/slow responses
- src/utils/hf-retry - frontend retry and axios interceptor utilities
- server/utils/hfClient.js - Node server-side HF client with keepalive + retry + circuit breaker
Quick usage:

Run the diagnostic scripts (`diag.sh` / `diag.ps1`) to capture headers and response bodies from the upstream endpoint. These scripts are minimal helpers and do not require the mock server.

Security note: Do NOT commit tokens. Use environment variables (`HF_TOKEN`, `HF_KEY`) and keep real secrets in your deployment host or CI secret store.
- Contact Hugging Face support with `x-request-id` and timestamps if upstream returns 5xx repeatedly.

```
