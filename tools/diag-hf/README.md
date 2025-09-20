# HF Inference Diagnostics & Resiliency Tools

This folder contains diagnostic scripts, a mock server, retry utilities, and tests to help investigate and fix 5xx/503/429 issues when calling Hugging Face Inference API.

Files added:
- diag.sh / diag.ps1 - simple diagnostic scripts (curl/Invoke-RestMethod)
- mock_hf_server.js - Express mock server simulating 200/429/503/slow responses
- src/utils/hf-retry - frontend retry and axios interceptor utilities
- server/utils/hfClient.js - Node server-side HF client with keepalive + retry + circuit breaker
- tests/hf - Jest tests for the retry client

Quick usage:

Start mock server:

```bash
node tools/diag-hf/mock_hf_server.js
```

Run diag script:

```bash
./tools/diag-hf/diag.sh http://localhost:8088/models/owner/model
pwsh ./tools/diag-hf/diag.ps1 http://localhost:8088/models/owner/model

1) Reproduction and quick checks
--------------------------------

Windows PowerShell (Invoke-RestMethod)

```powershell
$headers = @{ 'Authorization' = "Bearer $env:HF_TOKEN" ; 'Content-Type' = 'application/json' }
Invoke-RestMethod -Uri 'https://api-inference.huggingface.co/models/OWNER/MODEL' -Method Post -Headers $headers -Body (ConvertTo-Json @{ inputs = 'hello' }) -ErrorAction Stop
```

Windows curl.exe (shows headers)

```powershell
curl.exe -i -X POST "https://api-inference.huggingface.co/models/OWNER/MODEL" -H "Authorization: Bearer $env:HF_TOKEN" -H "Content-Type: application/json" -d '{"inputs":"hello"}'
```

Linux/macOS curl

```bash
curl -i -X POST "https://api-inference.huggingface.co/models/OWNER/MODEL" -H "Authorization: Bearer $HF_TOKEN" -H "Content-Type: application/json" -d '{"inputs":"hello"}'
```

2) Frontend examples (use utilities in src/utils/hf-retry)
-------------------------------------------------------

- Fetch (use postWithRetry):

```ts
import { postWithRetry } from '../../src/utils/hf-retry/postWithRetry';
const result = await postWithRetry('/api/proxy/dbquery', { inputs: 'hello' }, process.env.HF_TOKEN);
```

- Axios (attach interceptor):

```ts
import axios from 'axios';
import { attachRetryInterceptor } from '../../src/utils/hf-retry/axiosRetry';
const client = attachRetryInterceptor(axios.create(), { maxAttempts: 5 });
await client.post('/api/proxy/dbquery', { inputs: 'hi' });
```

3) Node server example
-----------------------

Use `server/utils/hfClient.js` to create an axios instance with keepalive and retry. Example:

```js
const { createClient } = require('./server/utils/hfClient');
const hf = createClient({ baseURL: process.env.HF_API_BASE || 'https://api-inference.huggingface.co/models', token: process.env.HF_TOKEN });
await hf.post('/OWNER/MODEL', { inputs: 'test' });
```

4) Python example (requests + retry)
-----------------------------------

See `server/python/hf_client.py` for a minimal example using requests and urllib3 Retry. Run pytest in `tests/py` to verify behavior against the mock server.

5) NGINX reverse-proxy snippet
------------------------------

Save as `nginx_hf.conf` and include in your site config.

```nginx
location /api/proxy/dbquery {
	proxy_pass https://api-inference.huggingface.co/models/OWNER/MODEL;
	proxy_set_header Authorization "Bearer $HF_TOKEN";
	proxy_set_header Host api-inference.huggingface.co;
	proxy_connect_timeout 10s;
	proxy_read_timeout 90s;
	proxy_send_timeout 90s;
	proxy_http_version 1.1;
	proxy_set_header Connection "";
	client_max_body_size 5m;
}
```

6) Prometheus alert example
--------------------------

Prometheus rule to alert on high 5xx rate (example):

```yaml
groups:
- name: hf-service.rules
	rules:
	- alert: HFHigh5xxRate
		expr: increase(http_requests_total{job="your-api",status=~"5.."}[5m]) > 10
		for: 2m
		labels:
			severity: critical
		annotations:
			summary: "High 5xx rate for HF proxied requests"
			description: "More than 10 5xx responses in the last 5m"
```

7) Security
-----------

- Do NOT commit tokens. Use env vars: `HF_TOKEN` or `HF_KEY` as appropriate.
- Add `.env.example` with placeholder `HF_TOKEN=YOUR_HF_TOKEN` and keep real secrets in your host/CI secrets store.

8) If you still get 503 after these changes
------------------------------------------

- Double-check actual upstream headers (Retry-After/x-request-id/x-rate-limit) using `diag.sh`/`diag.ps1`.
- Increase proxy timeouts (NGINX `proxy_read_timeout`) and client per-attempt timeouts.
- Consider moving to a local hosted model or alternate provider if upstream is unreliable.
- Contact Hugging Face support with `x-request-id` and timestamps if upstream returns 5xx repeatedly.

```
