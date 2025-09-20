#!/usr/bin/env bash
# diag.sh - simple diagnostic script for HF inference endpoints
set -euo pipefail

URL=${1:-}
TOKEN=${2:-}
OUTDIR=${3:-./diag-out}
mkdir -p "$OUTDIR"

if [ -z "$URL" ]; then
  echo "Usage: $0 <endpoint-url> [HF_TOKEN] [outdir]"
  exit 2
fi

echo "POSTing to $URL"
echo "Saving output to $OUTDIR"

TMP_HEADERS="$OUTDIR/headers.txt"
TMP_BODY="$OUTDIR/body.json"

if [ -n "$TOKEN" ]; then
  AUTH_HEADER=( -H "Authorization: Bearer $TOKEN" )
else
  AUTH_HEADER=()
fi

curl -i -sS "${AUTH_HEADER[@]}" -H "Content-Type: application/json" -d '{"inputs":"test"}' "$URL" -D "$TMP_HEADERS" -o "$TMP_BODY" || true

STATUS=$(head -n 1 "$TMP_HEADERS" | awk '{print $2}')
echo "HTTP status: $STATUS"

echo "Relevant headers:"
grep -iE 'Retry-After|x-request-id|x-rate-limit' "$TMP_HEADERS" || true

echo "Response body (first 2048 bytes):"
head -c 2048 "$TMP_BODY" || true

if [ "$STATUS" = "429" ]; then
  echo "Got 429 Too Many Requests"
  grep -i 'Retry-After' "$TMP_HEADERS" || true
fi

if [ "$STATUS" = "503" ] || [ "$STATUS" = "502" ]; then
  echo "Upstream service unavailable (502/503)"
fi

echo "diag.sh finished"
