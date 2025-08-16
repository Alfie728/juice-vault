#!/bin/bash
# Reset database (deletes all data!)
docker compose exec -T nextjs pnpm prisma db push --force-reset
echo "✅ Database reset"