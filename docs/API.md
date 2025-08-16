# JuiceVault API Documentation

## Overview

JuiceVault uses tRPC for type-safe APIs. All endpoints are accessible through the tRPC client with full TypeScript support.

## Authentication

Protected endpoints require a valid session through NextAuth.js.

## Song Endpoints

### List Songs
```typescript
trpc.song.list.query()
```
Returns all songs with metadata.

### Get Song
```typescript
trpc.song.get.query({ id: string })
```
Returns a specific song by ID.

### Search Songs
```typescript
trpc.song.search.query({ 
  query: string,
  type: "text" | "semantic" 
})
```
Search songs by text or semantic similarity.

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
Creates a new song entry.

### Update Song
```typescript
trpc.song.update.mutate({
  id: string,
  title?: string,
  artist?: string,
  // ... other fields
})
```
Updates an existing song.

### Delete Song
```typescript
trpc.song.delete.mutate({ id: string })
```
Deletes a song and its associated data.

### Get Presigned Upload URL
```typescript
trpc.song.getPresignedUrl.query({
  fileName: string,
  fileType: string
})
```
Returns a presigned URL for S3 upload.

## Lyrics Endpoints

### Get Lyrics
```typescript
trpc.lyrics.get.query({ songId: string })
```
Returns lyrics for a specific song.

### Generate Lyrics
```typescript
trpc.lyrics.generate.mutate({ songId: string })
```
Triggers AI lyrics generation from audio.

### Update Lyrics
```typescript
trpc.lyrics.update.mutate({
  id: string,
  fullLyrics?: string,
  syncedLines?: Array<{
    text: string,
    startTime: number,
    endTime?: number
  }>
})
```
Updates lyrics content or timing.

## User Endpoints

### Get Current User
```typescript
trpc.user.me.query()
```
Returns the current authenticated user.

### Update Profile
```typescript
trpc.user.update.mutate({
  name?: string,
  image?: string
})
```
Updates user profile information.

## Error Handling

All endpoints return standard tRPC errors:
- `UNAUTHORIZED` - Not authenticated
- `NOT_FOUND` - Resource not found
- `BAD_REQUEST` - Invalid input
- `INTERNAL_SERVER_ERROR` - Server error

## Usage Example

```typescript
import { api } from "~/trpc/react";

function MyComponent() {
  const { data: songs } = api.song.list.useQuery();
  
  const createSong = api.song.create.useMutation({
    onSuccess: () => {
      console.log("Song created!");
    }
  });
  
  return (
    // Your component JSX
  );
}
```