#!/bin/bash
# Restart all services
docker compose down
docker compose up --build -d
echo "✅ Restarted"