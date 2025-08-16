# JuiceVault Quick Start Guide

## Prerequisites

- Docker Desktop installed and running
- Git

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/juice-vault.git
cd juice-vault
```

### 2. Switch to local database (optional)
```bash
./scripts/use-local.sh
```
This uses Docker's PostgreSQL instead of production database.

### 3. Start everything
```bash
./scripts/start.sh
```

This starts:
- Next.js app at http://localhost:3000
- PostgreSQL database
- Grafana dashboard at http://localhost:3001 (admin/admin)

### 4. View logs if needed
```bash
./scripts/logs.sh          # All logs
./scripts/logs-nextjs.sh   # Just app logs
```

### 5. Open Prisma Studio to view data
```bash
./scripts/studio.sh
```

### 6. Stop when done
```bash
./scripts/stop.sh
```

## Environment Variables

Create a `.env` file with:
```env
# Required for lyrics transcription
OPENAI_API_KEY=sk-...

# Optional for OAuth login
AUTH_DISCORD_ID=...
AUTH_DISCORD_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...

# Optional for file storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
```

## Useful Scripts

Each script does ONE thing - no arguments needed:

```bash
./scripts/start.sh         # Start everything
./scripts/stop.sh          # Stop everything
./scripts/restart.sh       # Restart all
./scripts/logs.sh          # View logs
./scripts/studio.sh        # Prisma Studio
./scripts/db-push.sh       # Update database schema
./scripts/lint.sh          # Run linting
./scripts/test-lyrics.sh   # Test lyrics service
```

## Troubleshooting

### Port conflicts
If port 3000 or 5432 is in use:
```bash
./scripts/stop.sh
# Then check what's using the ports:
lsof -i :3000
lsof -i :5432
```

### Database issues
```bash
./scripts/db-reset.sh  # Reset database (deletes data!)
./scripts/db-push.sh   # Push schema changes
```

### Clean start
```bash
./scripts/clean.sh     # Remove everything
./scripts/start.sh     # Start fresh
```