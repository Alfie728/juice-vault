# JuiceVault Architecture & Patterns

## Project Structure

```
juice-vault/
├── src/
│   ├── app/                 # Next.js 15 App Router
│   ├── server/              # Backend (tRPC + business logic)
│   ├── domain/              # Core business domain (Effect-based services)
│   ├── features/            # Frontend feature modules
│   ├── components/          # Shared UI components (deprecated, use features)
│   └── trpc/               # tRPC configuration
```

## Backend Patterns

### 1. Effect-based Services

All business logic uses Effect for functional error handling and composition:

```typescript
// src/domain/ai/lyrics-service.ts
export class LyricsAIService extends Effect.Service<LyricsAIService>()("LyricsAIService", {
  effect: Effect.gen(function* () {
    const openai = yield* OpenAIService;

    return {
      generateLyrics: (input: GenerateLyricsInput) =>
        Effect.gen(function* () {
          // Validate input
          const validInput = yield* Schema.decodeUnknown(GenerateLyricsInputSchema)(input);

          // Process with error handling
          const result = yield* Effect.tryPromise({
            try: () => openai.transcribe(validInput.audioUrl),
            catch: (error) => new AiError({ message: "Transcription failed" })
          });

          return result;
        }).pipe(
          Effect.withSpan("generateLyrics", { attributes: { songTitle: input.songTitle } })
        ),
    };
  }),
  dependencies: [OpenAIService.Default],
});
```

**Key patterns:**
- Services extend `Effect.Service` for dependency injection
- Use `Effect.gen` for readable async code
- Use `Schema` for runtime validation
- Custom error types extend `Data.TaggedError`
- Add OpenTelemetry spans with `Effect.withSpan`

### 2. tRPC Router Pattern

```typescript
// src/server/api/routers/song.ts
export const songRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const program = Effect.gen(function* () {
      const songService = yield* SongService;
      return yield* songService.getAllSongs();
    }).pipe(
      Effect.catchTags({
        DatabaseError: (error) =>
          Effect.fail(
            new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: error.message,
            })
          ),
        ValidationError: (error) =>
          Effect.fail(
            new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            })
          ),
      })
    );

    return ctx.runtime.runPromise(program);
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        artist: z.string().default("Juice WRLD"),
        audioUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const program = Effect.gen(function* () {
        const songService = yield* SongService;
        return yield* songService.createSong({
          ...input,
          uploadedBy: { id: ctx.session.user.id },
        });
      }).pipe(
        Effect.catchTags({
          ValidationError: (error) =>
            Effect.fail(
              new TRPCError({
                code: "BAD_REQUEST",
                message: error.message,
              })
            ),
          DatabaseError: (error) =>
            Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error.message,
              })
            ),
        })
      );

      return ctx.runtime.runPromise(program);
    }),
});
```

**Key patterns:**
- Use `publicProcedure` for public endpoints
- Use `protectedProcedure` for authenticated endpoints
- Use `ctx.runtime.runPromise(program)` to execute Effect programs
- Services are injected via the runtime context, not provided explicitly
- Use `Effect.catchTags` for granular error handling
- Map domain errors to appropriate tRPC error codes

### 3. Database Access with Prisma

```typescript
// Direct Prisma usage in routers (simple CRUD)
const song = await ctx.db.song.findUnique({
  where: { id: input.id },
  include: {
    user: true,
    lyrics: true,
  },
});

// Complex queries in services
export class SongService extends Effect.Service<SongService>()("SongService", {
  effect: Effect.gen(function* () {
    const db = yield* Database;

    return {
      searchSongs: (query: string) =>
        Effect.tryPromise({
          try: () => db.song.findMany({
            where: {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { artist: { contains: query, mode: 'insensitive' } },
              ],
            },
          }),
          catch: (e) => new DatabaseError({ message: "Search failed" }),
        }),
    };
  }),
});
```

## Frontend Patterns

### 1. Feature-based Organization

```
src/features/
├── song/
│   ├── components/
│   │   ├── SongCard.tsx
│   │   ├── SongGrid.tsx
│   │   └── SongUploadDialog.tsx
│   ├── hooks/
│   │   └── use-song-upload.ts
│   └── types/
│       └── song.ts
├── player/
│   ├── components/
│   │   └── MusicPlayer.tsx
│   └── hooks/
│       └── use-audio-player.tsx
└── shared/
    └── components/
        ├── ui/           # Shadcn UI components
        └── LoadingSpinner.tsx
```

### 2. Component Patterns

**Server Components (default in app directory):**
```typescript
// src/app/(home)/page.tsx
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export default async function HomePage() {
  // Prefetch data on the server - this populates the query cache
  prefetch(trpc.song.list.queryOptions());
  
  // Prefetch multiple queries (they run in parallel automatically)
  prefetch(trpc.song.list.queryOptions());
  prefetch(trpc.user.me.queryOptions());
  
  return (
    <HydrateClient>
      {/* Client components can now use the prefetched data */}
      <SongGrid />
    </HydrateClient>
  );
}

// Alternative: Direct server-side call (without client hydration)
export default async function HomePage() {
  // Direct call - useful for data that won't be used by client components
  const songs = await trpc.song.list.query();
  
  return <StaticSongList songs={songs} />;
}
```

**Client Components (with "use client"):**
```typescript
// src/features/song/components/SongCard.tsx
"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTRPC } from "~/trpc/react";

export function SongCard({ song }: { song: Song }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const deleteSong = useMutation(
    trpc.song.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.song.list.queryKey(),
        });
        toast.success("Song deleted");
      },
    })
  );

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="rounded-lg border border-zinc-800"
    >
      {/* Component JSX */}
    </motion.div>
  );
}
```

### 3. Data Fetching Patterns

**Server-Side Prefetching Pattern:**
```typescript
// Server Component with prefetching
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export default async function Page() {
  // Prefetch populates the query cache on the server
  // Note: prefetch() runs in the background - no await needed
  prefetch(trpc.song.list.queryOptions());
  
  return (
    <HydrateClient>
      {/* Client components receive hydrated data - no loading state! */}
      <ClientComponent />
    </HydrateClient>
  );
}

// Client Component using prefetched data
"use client";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

function ClientComponent() {
  const trpc = useTRPC();
  // This will use prefetched data immediately, no loading state
  const { data: songs } = useQuery(trpc.song.list.queryOptions());
  
  return <SongGrid songs={songs} />;
}
```

**Benefits of Prefetching:**
- ✅ No loading spinners on initial page load
- ✅ Better SEO - data is rendered on the server
- ✅ Faster perceived performance
- ✅ Automatic deduplication - client won't refetch
- ✅ Type-safe from server to client

**When to Use Each Pattern:**
- **`prefetch()`** - When client components need the data (hydration pattern)
- **`.query()`** - When only server components need the data (no client hydration)
- **Note:** `prefetch()` runs in the background and doesn't block rendering

**Using tRPC with Tanstack Query v5:**
```typescript
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

// Get the tRPC client
const trpc = useTRPC();

// Query - using queryOptions with useQuery
const { data: songs, isLoading } = useQuery(
  trpc.song.list.queryOptions()
);

// Query with parameters
const { data: searchResults } = useQuery({
  ...trpc.song.search.queryOptions({ query: searchQuery, type: "text" }),
  enabled: searchQuery.length > 2, // Conditional fetching
});

// Mutation - using mutationOptions with useMutation
const uploadMutation = useMutation(
  trpc.song.upload.mutationOptions()
);

// Mutation with callbacks
const deleteMutation = useMutation(
  trpc.song.delete.mutationOptions({
    onSuccess: () => {
      toast.success("Song deleted");
      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: trpc.song.list.queryKey()
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  })
);

// Using mutation
const handleDelete = async (id: string) => {
  await deleteMutation.mutateAsync({ id });
};

// Optimistic updates
const updateMutation = useMutation(
  trpc.song.update.mutationOptions({
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: trpc.song.get.queryKey({ id: newData.id })
      });

      // Snapshot the previous value
      const previousSong = queryClient.getQueryData(
        trpc.song.get.queryKey({ id: newData.id })
      );

      // Optimistically update
      queryClient.setQueryData(
        trpc.song.get.queryKey({ id: newData.id }),
        (old) => ({ ...old, ...newData })
      );

      return { previousSong };
    },
    onError: (err, newData, context) => {
      // Rollback on error
      queryClient.setQueryData(
        trpc.song.get.queryKey({ id: newData.id }),
        context?.previousSong
      );
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: trpc.song.get.queryKey({ id: newData.id })
      });
    }
  })
);
```

### 4. State Management Patterns

**Context for Global State:**
```typescript
// src/features/player/hooks/use-audio-player.tsx
const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const play = useCallback((song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);
  }, []);

  return (
    <AudioPlayerContext.Provider value={{ currentSong, isPlaying, play }}>
      {children}
      <audio ref={audioRef} />
    </AudioPlayerContext.Provider>
  );
}

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return context;
};
```

**Local State with useState/useReducer:**
```typescript
// For simple UI state
const [isOpen, setIsOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState("");

// For complex form state
const [formData, setFormData] = useReducer(
  (state: FormState, action: FormAction) => {
    switch (action.type) {
      case "SET_FIELD":
        return { ...state, [action.field]: action.value };
      case "RESET":
        return initialState;
      default:
        return state;
    }
  },
  initialState
);
```

### 5. UI Component Patterns

**Using Shadcn UI components:**
```typescript
import { Button } from "~/features/shared/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "~/features/shared/components/ui/dialog";

export function SongUploadDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="default">Upload Song</Button>
      </DialogTrigger>
      <DialogContent>
        {/* Dialog content */}
      </DialogContent>
    </Dialog>
  );
}
```

**Animation with Framer Motion:**
```typescript
import { motion, AnimatePresence } from "framer-motion";

export function AnimatedList({ items }: { items: Song[] }) {
  return (
    <AnimatePresence>
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ delay: index * 0.1 }}
        >
          <SongCard song={item} />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
```

## Authentication Pattern

Using NextAuth with multiple providers:

```typescript
// src/server/auth.ts
export const { auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      clientId: env.AUTH_DISCORD_ID,
      clientSecret: env.AUTH_DISCORD_SECRET,
    }),
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  adapter: PrismaAdapter(db),
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
});

// Protected route
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});
```

## Advanced Effect Patterns

### Program Separation Pattern

For complex operations involving AI services, separate concerns into focused programs to isolate error types and improve maintainability.

**Core Principle: Business Logic in Programs, Instrumentation in Pipes**

Always follow this pattern:
1. **Write pure business logic** inside `Effect.gen` programs
2. **Add instrumentation** (retry, error handling, spans) via `.pipe()`
3. **Keep programs focused** on a single responsibility

```typescript
// src/server/api/routers/lyrics.ts - Business Logic & Instrumentation Separation

export const lyricsRouter = createTRPCRouter({
  generateLyrics: protectedProcedure
    .input(GenerateLyricsInputSchema)
    .mutation(async ({ input, ctx }) => {
      
      // ✅ CORRECT: Business logic in program generator
      const transcribeAudioProgram = Effect.gen(function* () {
        // Pure business logic - what the program does
        const lyricsAI = yield* LyricsAIService;
        const httpClient = yield* HttpClient.HttpClient;

        // Fetch audio using Effect's HTTP client
        const response = yield* httpClient.get(input.audioUrl);
        const audioArrayBuffer = yield* response.arrayBuffer;
        const audioBuffer = Buffer.from(audioArrayBuffer);

        // Generate lyrics with AI transcription
        return yield* lyricsAI.generateLyrics({
          audioUrl: audioBuffer,
          songTitle: input.songTitle,
          artist: input.artist,
          duration: input.duration,
        });
        
        // ⚠️ NO retry logic here - that's instrumentation!
        // ⚠️ NO error handling here - that's instrumentation!
        // ⚠️ NO spans here - that's instrumentation!
        
      }).pipe(
        // ✅ INSTRUMENTATION: How the program behaves
        
        // Retry strategy
        Effect.retry({
          schedule: Schedule.exponential("1 second"),
          until: (error) => error._tag !== "AiError",
        }),
        
        // Error handling policy
        Effect.catchTags({
          ValidationError: (error) => Effect.fail(
            new TRPCError({ code: "BAD_REQUEST", message: `Validation error: ${error.message}` })
          ),
          RequestError: (error) => Effect.fail(
            new TRPCError({ code: "BAD_REQUEST", message: `Failed to fetch audio: ${error.message}` })
          ),
          ResponseError: (error) => Effect.fail(
            new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Network error: ${error.message}` })
          ),
          AiError: (error) => Effect.fail(
            new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI error: ${error.message}` })
          ),
        }),
        
        // Observability
        Effect.withSpan("lyrics.generate_with_retry", {
          attributes: {
            "lyrics.song_title": input.songTitle,
            "lyrics.artist": input.artist,
            "lyrics.duration": input.duration ?? 0,
            "lyrics.retry_max_attempts": 5,
            "lyrics.retry_schedule": "exponential_1s",
          },
        })
      );

      // ✅ CORRECT: Main program with pure business logic
      const generateLyricsProgram = Effect.gen(function* () {
        // Pure business logic - what the program does
        const lyricsService = yield* LyricsService;

        // Check if lyrics already exist
        const existingLyrics = yield* lyricsService
          .getLyricsBySongId(input.songId)
          .pipe(Effect.catchAll(() => Effect.succeed(null)));

        if (existingLyrics) {
          return {
            success: true,
            message: "Lyrics already exist",
            songId: input.songId,
            lyricsId: existingLyrics.id,
          };
        }

        // Get transcribed text from AI program
        const transcribedText = yield* transcribeAudioProgram;

        // Save to database
        const lyrics = yield* lyricsService.createLyrics({
          songId: input.songId,
          fullText: transcribedText,
          isGenerated: true,
        });

        return {
          success: true,
          message: "Lyrics generated successfully",
          songId: input.songId,
          lyricsId: lyrics.id,
        };
        
        // ⚠️ NO spans here - that's instrumentation!
        // ⚠️ NO catchTags here - that's instrumentation!
        
      }).pipe(
        // ✅ INSTRUMENTATION: How the program behaves
        
        // Observability
        Effect.withSpan("lyrics.generateLyrics", {
          attributes: {
            "operation.type": "generate_lyrics",
            "song.id": input.songId,
            "song.title": input.songTitle,
          },
        }),
        
        // Error handling policy
        Effect.catchTags({
          DatabaseError: (error) => Effect.fail(
            new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message })
          ),
          ValidationError: (error) => Effect.fail(
            new TRPCError({ code: "BAD_REQUEST", message: error.message })
          ),
        })
      );

      return ctx.runtime.runPromise(generateLyricsProgram);
    }),
});
```

**Key Principles of Business Logic & Instrumentation Separation:**

### ✅ DO: Business Logic in Program Generators
```typescript
const myProgram = Effect.gen(function* () {
  // ✅ Pure business logic - what the program does
  const service = yield* MyService;
  const data = yield* service.fetchData();
  const processed = yield* service.processData(data);
  return processed;
}).pipe(
  // ✅ Instrumentation - how the program behaves
  Effect.retry(retryPolicy),
  Effect.catchTags(errorHandlers),
  Effect.withSpan("operation.name")
);
```

### ❌ DON'T: Mix Business Logic with Instrumentation
```typescript
const badProgram = Effect.gen(function* () {
  // ❌ Business logic mixed with instrumentation
  const service = yield* MyService;
  const data = yield* Effect.withSpan(
    service.fetchData().pipe(
      Effect.retry(somePolicy),
      Effect.catchTag("Error", handleError)
    ),
    "fetch.span"
  );
  return data;
});
```

**Key Benefits of This Separation:**
- ✅ **Clarity**: Business logic is pure and easy to understand
- ✅ **Testability**: Can test business logic without instrumentation
- ✅ **Maintainability**: Change retry/error policies without touching business logic
- ✅ **Composability**: Reuse business logic with different instrumentation
- ✅ **Error Isolation**: AiErrors contained within AI programs
- ✅ **Type Safety**: Only relevant error types reach each catchTags

### Common Anti-Patterns to Avoid

```typescript
// ❌ BAD: Instrumentation mixed into business logic
const badPattern = Effect.gen(function* () {
  const service = yield* MyService;
  
  // ❌ Spans mixed with business logic
  const data = yield* Effect.withSpan(
    service.getData(),
    "get.data"
  );
  
  // ❌ Retry mixed with business logic
  const processed = yield* service.processData(data).pipe(
    Effect.retry(Schedule.exponential("1 second"))
  );
  
  // ❌ Error handling mixed with business logic
  const saved = yield* service.saveData(processed).pipe(
    Effect.catchTag("DatabaseError", (error) => 
      Effect.succeed({ error: error.message })
    )
  );
  
  return saved;
});

// ✅ GOOD: Pure business logic, instrumentation in pipe
const goodPattern = Effect.gen(function* () {
  const service = yield* MyService;
  
  // ✅ Pure business logic only
  const data = yield* service.getData();
  const processed = yield* service.processData(data);
  const saved = yield* service.saveData(processed);
  
  return saved;
}).pipe(
  // ✅ All instrumentation separated
  Effect.retry(Schedule.exponential("1 second")),
  Effect.catchTags({
    DatabaseError: (error) => Effect.succeed({ error: error.message }),
    ValidationError: (error) => Effect.fail(new TRPCError({ ... })),
  }),
  Effect.withSpan("complete.operation", { attributes: { ... } })
);
```

### Retry Patterns with Effect

```typescript
// Selective retry - only retry specific error types
Effect.retry({
  schedule: Schedule.exponential("1 second"), // Exponential backoff
  until: (error) => {
    // Only retry AiErrors, fail fast on other errors
    return error._tag !== "AiError";
  },
})

// Alternative: Retry with maximum attempts
Effect.retry({
  schedule: Schedule.exponential("1 second").pipe(
    Schedule.intersect(Schedule.recurs(5)) // Max 5 retries
  ),
  until: (error) => error._tag !== "AiError",
})

// Conditional retry with complex logic
Effect.retry({
  schedule: Schedule.exponential("1 second"),
  until: (error) => {
    // Custom retry logic based on error type and properties
    if (error._tag === "AiError") return false; // Retry AiErrors
    if (error._tag === "RateLimitError") return false; // Retry rate limits
    return true; // Don't retry other errors
  },
})
```

### Observability Patterns

```typescript
// Comprehensive span attributes for business context
Effect.withSpan("operation.name", {
  attributes: {
    // Business context
    "song.id": songId,
    "song.title": songTitle,
    "user.id": userId,
    
    // Operation metadata
    "operation.type": "ai_transcription",
    "operation.input_size": audioBuffer.length,
    
    // Retry configuration
    "retry.max_attempts": 5,
    "retry.schedule": "exponential_1s",
    "retry.condition": "AiError_only",
    
    // Performance metrics
    "audio.duration_seconds": duration,
    "audio.format": "mp3",
  },
})

// Nested spans for granular tracing
Effect.gen(function* () {
  const result = yield* Effect.withSpan(
    performComplexOperation(),
    "operation.sub_task",
    { attributes: { "task.step": "preprocessing" } }
  );
  
  const finalResult = yield* Effect.withSpan(
    processResult(result),
    "operation.sub_task",
    { attributes: { "task.step": "postprocessing" } }
  );
  
  return finalResult;
}).pipe(
  Effect.withSpan("operation.main", {
    attributes: { "operation.complexity": "high" }
  })
);
```

### HTTP Client Integration

```typescript
// Using Effect's HTTP client for better integration
Effect.gen(function* () {
  const httpClient = yield* HttpClient.HttpClient;
  
  // Fetch binary data (audio files)
  const response = yield* httpClient.get(audioUrl);
  const arrayBuffer = yield* response.arrayBuffer;
  const buffer = Buffer.from(arrayBuffer);
  
  // HTTP client automatically handles:
  // - Connection pooling
  // - Timeout management
  // - Error mapping to Effect error types
  
  return buffer;
}).pipe(
  Effect.catchTags({
    RequestError: (error) => handleRequestError(error),
    ResponseError: (error) => handleResponseError(error),
  })
);
```

## Error Handling Patterns

### Backend Errors with Effect

```typescript
// Define custom errors
export class AiError extends Data.TaggedError("AiError")<{
  message: string;
  cause?: unknown;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  message: string;
  errors?: unknown;
}> {}

// Handle errors in services
Effect.gen(function* () {
  const result = yield* Effect.tryPromise({
    try: () => someAsyncOperation(),
    catch: (error) => new AiError({
      message: "Operation failed",
      cause: error
    }),
  });
  return result;
}).pipe(
  Effect.catchTag("AiError", (error) =>
    Effect.succeed({ error: error.message })
  )
);
```

### Frontend Error Handling

```typescript
// With tRPC mutations
const mutation = api.song.create.useMutation({
  onError: (error) => {
    if (error.data?.code === 'UNAUTHORIZED') {
      router.push('/login');
    } else {
      toast.error(error.message || "Something went wrong");
    }
  },
});

// With error boundaries
export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      fallback={<ErrorFallback />}
      onReset={() => window.location.reload()}
    >
      {children}
    </ReactErrorBoundary>
  );
}
```

## Testing Patterns

### Testing Effect Services

```typescript
// src/domain/ai/lyrics.test.ts
const testProgram = Effect.gen(function* () {
  const lyricsService = yield* LyricsAIService;

  const result = yield* lyricsService.generateLyrics({
    audioUrl: testAudioBuffer,
    songTitle: "Test Song",
    artist: "Test Artist",
  });

  expect(result).toBeDefined();
}).pipe(
  Effect.provide(LyricsAIService.Default),
  Effect.provide(NodeSdkLive) // OpenTelemetry for testing
);

await Effect.runPromise(testProgram);
```

## Performance Patterns

### 1. Image Optimization
```typescript
import Image from "next/image";

<Image
  src={song.coverArtUrl}
  alt={song.title}
  width={300}
  height={300}
  loading="lazy"
  placeholder="blur"
  blurDataURL={song.blurDataUrl}
/>
```

### 2. Code Splitting
```typescript
// Dynamic imports for heavy components
const MusicPlayer = dynamic(
  () => import("~/features/player/components/MusicPlayer"),
  { ssr: false }
);
```

### 3. Query Optimization
```typescript
// Parallel queries (for direct server-side calls)
const [songs, user] = await Promise.all([
  trpc.song.list.query(),
  trpc.user.me.query(),
]);

// Prefetching (for hydration - runs in background)
prefetch(trpc.song.list.queryOptions());
prefetch(trpc.user.me.queryOptions());
```

## Environment Configuration

```typescript
// src/env.js - Type-safe environment variables
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    OPENAI_API_KEY: z.string().optional(),
    AUTH_SECRET: z.string(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    // ... map all env vars
  },
});
```
