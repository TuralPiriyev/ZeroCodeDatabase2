PayPal Subscriptions Integration

Overview
- This repo includes a client-side PayPal Subscriptions component and a server-side fallback that creates subscriptions server-side and redirects users to PayPal approval page. The client component prefers in-context SDK flow but falls back to the server endpoint when errors occur.

.env / secrets
- Do NOT commit real secrets. Use `.env` (not checked in) for server secrets. `.env.example` included.
- Frontend env (exposed to client):
  - REACT_APP_PAYPAL_CLIENT_ID
  - REACT_APP_PAYPAL_PLAN_ID
  - REACT_APP_PAYPAL_ENV (sandbox|production)
- Server env (private):
  - PAYPAL_CLIENT_ID
  - PAYPAL_CLIENT_SECRET
  - PAYPAL_API_BASE (optional)

Testing checklist
1. Start server and client concurrently (example script in package.json):
   - npm run dev (uses concurrently)
2. Test in a normal browser and incognito.
3. Disable adblock/privacy extensions.
4. If client-side flow fails, component.onError will redirect to `/api/pay/fallback-subscription?plan_id=...`.
5. If fallback also fails, collect console `uid` and `csnwCorrelationId` printed by the PayPal SDK/console and contact PayPal support.

Dev proxy
- For dev convenience, set `proxy` in front-end `package.json` to point to the server (e.g. `"proxy": "http://localhost:8080"`) or configure Vite proxy.

Security notes
- Never expose `PAYPAL_CLIENT_SECRET` to the client.
- Keep server `.env` private and restricted.


Server start example (dev)
- npm run dev (concurrently runs vite and nodemon server)

If you want, I can add a test harness that simulates PayPal SDK errors and verifies fallback redirect.
