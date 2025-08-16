# JuiceVault Development Guide

## Development Workflow

### 1. Starting Development

```bash
# First time setup
./scripts/use-local.sh    # Use Docker database
./scripts/start.sh         # Start all services

# Daily development
./scripts/start.sh         # Start everything
./scripts/logs-nextjs.sh   # Monitor app logs
```

### 2. Making Changes

#### Frontend Changes
- **Hot Reload**: Changes to React components auto-refresh
- **Location**: `src/features/` for feature modules
- **Components**: Use Shadcn UI from `src/features/shared/components/ui/`

#### Backend Changes
- **API Routes**: Add to `src/server/api/routers/`
- **Business Logic**: Add Effect services to `src/domain/`
- **Database**: Modify `prisma/schema.prisma` then run `./scripts/db-push.sh`

### 3. Common Tasks

#### Add a New Feature

1. Create feature folder:
```
src/features/playlist/
├── components/
│   ├── PlaylistCard.tsx
│   └── PlaylistGrid.tsx
├── hooks/
│   └── use-playlist.ts
└── types/
    └── playlist.ts
```

2. Add tRPC router:
```typescript
// src/server/api/routers/playlist.ts
export const playlistRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.playlist.findMany();
  }),
});
```

3. Register router:
```typescript
// src/server/api/root.ts
export const appRouter = createTRPCRouter({
  song: songRouter,
  playlist: playlistRouter, // Add here
});
```

#### Add a Database Table

1. Edit schema:
```prisma
// prisma/schema.prisma
model Playlist {
  id        String   @id @default(cuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  songs     Song[]
  createdAt DateTime @default(now())
}
```

2. Push changes:
```bash
./scripts/db-push.sh
```

3. Generate types:
```bash
./scripts/db-generate.sh
```

#### Add an AI Service

1. Create Effect service:
```typescript
// src/domain/ai/recommendation-service.ts
export class RecommendationService extends Effect.Service<RecommendationService>()(
  "RecommendationService",
  {
    effect: Effect.gen(function* () {
      const openai = yield* OpenAIService;
      
      return {
        getRecommendations: (userId: string) =>
          Effect.gen(function* () {
            // Implementation
          }).pipe(
            Effect.withSpan("getRecommendations")
          ),
      };
    }),
    dependencies: [OpenAIService.Default],
  }
);
```

2. Use in tRPC:
```typescript
recommendations: protectedProcedure.query(async ({ ctx }) => {
  return Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* RecommendationService;
      return yield* service.getRecommendations(ctx.session.user.id);
    }).pipe(
      Effect.provide(RecommendationService.Default)
    )
  );
}),
```

### 4. Testing

#### Manual Testing
```bash
./scripts/studio.sh        # View/edit database
./scripts/logs.sh          # Check all logs
./scripts/test-lyrics.sh   # Test lyrics generation
```

#### Type Checking
```bash
./scripts/typecheck.sh     # Run TypeScript checks
./scripts/lint.sh          # Run ESLint
```

### 5. Debugging

#### View Logs
```bash
./scripts/logs.sh          # All logs
./scripts/logs-nextjs.sh   # App logs only
./scripts/logs-db.sh       # Database logs only
```

#### Connect to Container
```bash
./scripts/shell.sh         # Open shell in app container
./scripts/psql.sh          # Connect to PostgreSQL
```

#### View Traces
1. Open Grafana: http://localhost:3001 (admin/admin)
2. Go to Explore → Tempo
3. Search: `{resource.service.name="juice-vault-app"}`

### 6. Troubleshooting

#### "Port already in use"
```bash
./scripts/stop.sh
lsof -i :3000              # Check what's using port
kill -9 <PID>              # Kill process
./scripts/start.sh
```

#### "Cannot connect to database"
```bash
./scripts/status.sh        # Check if PostgreSQL is running
./scripts/use-local.sh     # Ensure using Docker DB
./scripts/restart.sh       # Restart everything
```

#### "Module not found"
```bash
./scripts/stop.sh
docker compose build --no-cache nextjs
./scripts/start.sh
```

#### "Prisma schema out of sync"
```bash
./scripts/db-push.sh       # Push schema changes
./scripts/db-generate.sh   # Regenerate client
```

### 7. Code Style Guide

#### TypeScript
- Use `type` for object shapes, `interface` for extensible contracts
- Prefer `const` assertions for literals
- Use Effect for async operations with error handling

#### React
- Use functional components with hooks
- Colocate related code in feature folders
- Extract reusable logic to custom hooks

#### Styling
- Use Tailwind CSS classes
- Follow mobile-first responsive design
- Use CSS variables for theming

#### Naming Conventions
- Components: PascalCase (`SongCard.tsx`)
- Hooks: camelCase with `use` prefix (`useSongUpload.ts`)
- Utils: camelCase (`formatDuration.ts`)
- Types: PascalCase (`Song`, `Playlist`)

### 8. Git Workflow

```bash
# Create feature branch
git checkout -b feature/playlist-ui

# Make changes and test
./scripts/lint.sh
./scripts/typecheck.sh

# Commit with conventional commits
git add .
git commit -m "feat: add playlist management UI"

# Push and create PR
git push origin feature/playlist-ui
```

### 9. Performance Tips

#### Frontend
- Use `React.memo` for expensive components
- Implement virtual scrolling for long lists
- Lazy load images with `next/image`
- Use `dynamic` imports for code splitting

#### Backend
- Add database indexes for frequently queried fields
- Implement pagination for list endpoints
- Cache expensive computations with React Query
- Use Effect's concurrent combinators for parallel operations

#### Database
- Use `select` to fetch only needed fields
- Implement cursor-based pagination for large datasets
- Add composite indexes for complex queries
- Use database transactions for multi-step operations

### 10. Deployment Checklist

Before deploying:
- [ ] Run `./scripts/typecheck.sh`
- [ ] Run `./scripts/lint.sh`
- [ ] Test critical user flows
- [ ] Check environment variables
- [ ] Review database migrations
- [ ] Test with production database (carefully!)
- [ ] Build production image: `./scripts/build.sh`