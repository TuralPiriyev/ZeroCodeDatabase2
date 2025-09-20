#!/usr/bin/env bash
echo "Testing local proxy at http://localhost:5000/api/proxy/models/owner/model"
curl -v -X POST http://localhost:5000/api/proxy/models/owner/model -H "Content-Type: application/json" -d '{"inputs":"test"}' || true
