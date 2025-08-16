#!/bin/bash
# Push database schema
docker compose exec -T nextjs pnpm prisma db push