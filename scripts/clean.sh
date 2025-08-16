#!/bin/bash
# Clean everything (containers, volumes, build artifacts)
docker compose down -v
rm -rf .next node_modules
echo "✅ Cleaned"