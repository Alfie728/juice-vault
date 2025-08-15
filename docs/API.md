# JuiceVault API Documentation

## Overview

JuiceVault uses tRPC for type-safe API endpoints with Effect-TS for service orchestration. All endpoints are accessible through the tRPC client with full TypeScript support.

## Authentication

All API endpoints requiring authentication use NextAuth.js. Protected endpoints check for valid session before processing requests.

## Song Endpoints

### Create Song

```typescript
trpc.song.create.mutate({
  title: string,
  artist: string,
  audioUrl: string,
  duration?: number,
  coverArtUrl?: string,
  releaseDate?: Date,
  isUnreleased?: boolean
})
```

**Returns**: Created song object
**Triggers**: 
- Lyrics generation job (if enabled)
- Embeddings generation job

### Get Song

```typescript
trpc.song.get.query({ id: string })
```

**Returns**: Song with user information

### Get Song with Lyrics

```typescript
trpc.song.getWithLyrics.query({ id: string })
```

**Returns**: Song with lyrics and synchronized lines

### List All Songs

```typescript
trpc.song.list.query()
```

**Returns**: Array of songs ordered by creation date

### Search Songs

```typescript
trpc.song.search.query({ 
  query: string,
  type?: 'text' | 'semantic' | 'hybrid'
})
```

**Returns**: Relevant songs based on search type

### Update Song

```typescript
trpc.song.update.mutate({
  id: string,
  title?: string,
  artist?: string,
  duration?: number,
  coverArtUrl?: string,
  releaseDate?: Date,
  isUnreleased?: boolean
})
```

**Returns**: Updated song object

### Delete Song

```typescript
trpc.song.delete.mutate({ id: string })
```

**Returns**: Success confirmation

### Increment Play Count

```typescript
trpc.song.incrementPlayCount.mutate({ id: string })
```

**Returns**: Updated song with new play count

## Lyrics Endpoints

### Create Lyrics

```typescript
trpc.lyrics.create.mutate({
  songId: string,
  fullText: string,
  isGenerated?: boolean,
  lines?: Array<{
    text: string,
    startTime: number,
    endTime?: number,
    orderIndex: number
  }>
})
```

**Returns**: Created lyrics object

### Update Lyrics

```typescript
trpc.lyrics.update.mutate({
  id: string,
  fullText?: string,
  isVerified?: boolean,
  lines?: Array<{
    text: string,
    startTime: number,
    endTime?: number,
    orderIndex: number
  }>
})
```

**Returns**: Updated lyrics object

### Get Lyrics by Song

```typescript
trpc.lyrics.getBySongId.query({ songId: string })
```

**Returns**: Lyrics with synchronized lines or null

### Generate Lyrics (AI)

```typescript
trpc.lyrics.generate.mutate({
  songId: string,
  audioUrl: string,
  songTitle: string,
  artist: string,
  duration?: number
})
```

**Returns**: Job ID for tracking
**Process**: Triggers background job for lyrics generation

### Sync Lyrics

```typescript
trpc.lyrics.sync.mutate({
  songId: string,
  lyricsId?: string,
  audioUrl: string,
  fullLyrics: string,
  duration?: number
})
```

**Returns**: Job ID for tracking
**Process**: Triggers background job for timestamp synchronization

### Delete Lyrics

```typescript
trpc.lyrics.delete.mutate({ id: string })
```

**Returns**: Success confirmation

## Playlist Endpoints

### Create Playlist

```typescript
trpc.playlist.create.mutate({
  name: string,
  description?: string,
  coverUrl?: string,
  isPublic?: boolean
})
```

**Returns**: Created playlist object

### Get Playlist

```typescript
trpc.playlist.get.query({ id: string })
```

**Returns**: Playlist with songs

### List User Playlists

```typescript
trpc.playlist.listUserPlaylists.query()
```

**Returns**: Array of user's playlists

### Add Song to Playlist

```typescript
trpc.playlist.addSong.mutate({
  playlistId: string,
  songId: string
})
```

**Returns**: Updated playlist

### Remove Song from Playlist

```typescript
trpc.playlist.removeSong.mutate({
  playlistId: string,
  songId: string
})
```

**Returns**: Updated playlist

### Update Playlist

```typescript
trpc.playlist.update.mutate({
  id: string,
  name?: string,
  description?: string,
  coverUrl?: string,
  isPublic?: boolean
})
```

**Returns**: Updated playlist

### Delete Playlist

```typescript
trpc.playlist.delete.mutate({ id: string })
```

**Returns**: Success confirmation

## User Endpoints

### Like Song

```typescript
trpc.user.likeSong.mutate({ songId: string })
```

**Returns**: Success confirmation

### Unlike Song

```typescript
trpc.user.unlikeSong.mutate({ songId: string })
```

**Returns**: Success confirmation

### Get Liked Songs

```typescript
trpc.user.getLikedSongs.query()
```

**Returns**: Array of liked songs

## Job Status Endpoints

### Get Job Status

```typescript
trpc.jobs.getStatus.query({ jobId: string })
```

**Returns**: Job status and metadata

### List Song Jobs

```typescript
trpc.jobs.listBySong.query({ songId: string })
```

**Returns**: Array of processing jobs for a song

## Search Endpoints

### Semantic Search

```typescript
trpc.search.semantic.query({
  query: string,
  limit?: number
})
```

**Returns**: Songs ranked by semantic similarity

### Hybrid Search

```typescript
trpc.search.hybrid.query({
  query: string,
  limit?: number
})
```

**Returns**: Combined semantic and text search results

## WebSocket Events (Real-time Updates)

### Lyrics Update

```typescript
socket.on('lyrics:updated', (data: {
  songId: string,
  lyricsId: string,
  currentLine: number
}))
```

### Job Status Update

```typescript
socket.on('job:status', (data: {
  jobId: string,
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
  progress?: number,
  error?: string
}))
```

## Error Handling

All endpoints use Effect-TS error types:

```typescript
type ApiError = 
  | ValidationError    // Invalid input
  | NotFoundError      // Resource not found
  | DatabaseError      // Database operation failed
  | UnauthorizedError  // Authentication required
```

Example error handling:

```typescript
try {
  const song = await trpc.song.get.query({ id });
} catch (error) {
  if (error.code === 'NOT_FOUND') {
    // Handle not found
  } else if (error.code === 'UNAUTHORIZED') {
    // Redirect to login
  }
}
```

## Rate Limiting

(To be implemented)

- Anonymous: 10 requests/minute
- Authenticated: 100 requests/minute
- Upload operations: 5/hour

## Pagination

For list endpoints:

```typescript
trpc.song.list.query({
  cursor?: string,
  limit?: number // Default: 20, Max: 100
})
```

Returns:
```typescript
{
  items: Song[],
  nextCursor?: string
}
```