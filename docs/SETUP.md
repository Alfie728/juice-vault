# JuiceVault Setup Guide

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- pnpm package manager
- OpenAI API key
- Upstash Vector database account
- Trigger.dev account (for background jobs)

## Installation Steps

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd juice-vault
pnpm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# OpenAI
OPENAI_API_KEY="sk-..."

# Upstash Vector
UPSTASH_VECTOR_REST_URL="https://..."
UPSTASH_VECTOR_REST_TOKEN="..."

# Trigger.dev
TRIGGER_API_KEY="..."
TRIGGER_API_URL="https://api.trigger.dev" # or your self-hosted URL

# Optional: File Storage (configure based on your choice)
# AWS S3
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_BUCKET_NAME="..."
AWS_REGION="..."

# OR Cloudinary
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

### 3. Database Setup

```bash
# Generate Prisma client
pnpm prisma generate

# Run database migrations
pnpm prisma migrate deploy

# (Optional) Seed database with sample data
pnpm prisma db seed
```

### 4. Upstash Vector Setup

1. Create an account at [Upstash](https://upstash.com)
2. Create a new Vector database
3. Choose dimension size: 1536 (for OpenAI embeddings)
4. Copy the REST URL and token to your `.env` file

### 5. Trigger.dev Setup

1. Sign up at [Trigger.dev](https://trigger.dev)
2. Create a new project
3. Copy the API key to your `.env` file
4. Initialize Trigger.dev in your project:

```bash
npx @trigger.dev/cli@latest init
```

5. Deploy your jobs:

```bash
npx @trigger.dev/cli@latest deploy
```

### 6. File Storage Setup

Choose one of the following options:

#### Option A: AWS S3

1. Create an S3 bucket
2. Configure CORS for your domain
3. Create IAM user with S3 access
4. Add credentials to `.env`

#### Option B: Cloudinary

1. Create Cloudinary account
2. Get API credentials
3. Add to `.env`

#### Option C: Local Storage (Development only)

```bash
# Create uploads directory
mkdir -p public/uploads
```

### 7. Run Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

## Production Deployment

### Vercel Deployment

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Docker Deployment

```dockerfile
# Dockerfile (to be created)
FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

```bash
docker build -t juice-vault .
docker run -p 3000:3000 --env-file .env juice-vault
```

## Testing

### Run Tests

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

### Test Coverage

```bash
pnpm test:coverage
```

## Common Issues & Solutions

### Issue: Database connection errors

**Solution**: Ensure PostgreSQL is running and connection string is correct

### Issue: Trigger.dev jobs not running

**Solution**: 
1. Check API key is correct
2. Ensure jobs are deployed: `npx @trigger.dev/cli@latest deploy`
3. Check Trigger.dev dashboard for errors

### Issue: Embeddings not working

**Solution**:
1. Verify OpenAI API key has access to embeddings
2. Check Upstash Vector credentials
3. Ensure vector dimension matches (1536)

### Issue: File uploads failing

**Solution**:
1. Check file storage configuration
2. Verify upload limits in `next.config.js`
3. Check CORS settings for cloud storage

## Development Tips

### Using Effect Services

```typescript
// Example: Using a service in a component
import { Effect } from "effect";
import { SongService } from "~/domain/song/service";

const getSongs = async () => {
  const program = Effect.gen(function* () {
    const songService = yield* SongService;
    return yield* songService.getAllSongs();
  });

  return Effect.runPromise(
    program.pipe(Effect.provide(SongService.Default))
  );
};
```

### Adding New Background Jobs

1. Create job file in `/src/jobs/`
2. Register in `/src/jobs/index.ts`
3. Deploy: `npx @trigger.dev/cli@latest deploy`

### Database Migrations

```bash
# Create migration after schema changes
pnpm prisma migrate dev --name description_of_changes

# Reset database (WARNING: deletes all data)
pnpm prisma migrate reset
```

## Monitoring

### Application Logs

- Development: Console output
- Production: Check deployment platform logs (Vercel, etc.)

### Background Jobs

- Monitor at Trigger.dev dashboard
- Check job status in `ProcessingJob` table

### Database

```bash
# Open Prisma Studio for database inspection
pnpm prisma studio
```

## Security Checklist

- [ ] Environment variables secured
- [ ] Authentication configured
- [ ] File upload validation implemented
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] SQL injection protection (handled by Prisma)
- [ ] XSS protection (handled by React)
- [ ] CSRF protection (handled by NextAuth)