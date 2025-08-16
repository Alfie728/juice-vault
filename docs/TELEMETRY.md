# OpenTelemetry and Tracing Setup

This document explains how to test and monitor the Lyrics AI Service using OpenTelemetry.

## Quick Start

### 1. Basic Console Tracing

Run the basic test with console output:

```bash
pnpm test:lyrics
```

This will:
- Generate lyrics from audio using Whisper AI
- Sync lyrics with timestamps using GPT-4
- Output traces to the console

### 2. Advanced Tracing with Jaeger

For a full tracing visualization:

1. Start Jaeger:
```bash
docker-compose -f docker-compose.jaeger.yml up -d
```

2. Run the test with Jaeger export:
```bash
pnpm test:lyrics:jaeger
```

3. View traces in Jaeger UI:
   - Open http://localhost:16686
   - Select service: `juice-vault-lyrics`
   - Click "Find Traces"

## Test Files

- `src/domain/ai/lyrics.test.ts` - Basic test with console tracing
- `src/domain/ai/lyrics-with-jaeger.test.ts` - Advanced test with Jaeger

## What Gets Traced

The lyrics service creates spans for:
- `generateLyrics` - Audio transcription with Whisper
- `syncLyricsWithTimestamps` - Timestamp generation with GPT-4
- `improveTimestamps` - Beat alignment optimization

Each span includes:
- Duration
- Status (success/error)
- Attributes (song title, artist, duration, etc.)
- Error details if failed

## Customizing Tests

Edit the test files to use real audio URLs:

```typescript
const testInput = {
  audioUrl: "https://your-s3-bucket.s3.amazonaws.com/song.mp3", // Your real URL
  songTitle: "Your Song Title",
  artist: "Artist Name",
  duration: 240, // Duration in seconds
};
```

## Environment Variables

For production use, you'll need:
- `OPENAI_API_KEY` - For Whisper and GPT-4 access

## Troubleshooting

### Jaeger not receiving traces
- Check Jaeger is running: `docker ps`
- Verify port 4318 is available
- Check console for connection errors

### Lyrics generation fails
- Verify OpenAI API key is set
- Check audio URL is accessible
- Ensure audio format is supported (mp3, wav, etc.)

## Monitoring in Production

For production, consider:
1. Using a managed service like Datadog, New Relic, or Honeycomb
2. Setting up proper sampling rates
3. Adding custom metrics for business KPIs
4. Setting up alerts for error rates

## Effect Tracing Features

The Effect library provides powerful tracing:
- Automatic span creation with `Effect.withSpan`
- Retry policies with traced attempts
- Error tracking and categorization
- Performance metrics

## Next Steps

1. Add real audio files for testing
2. Set up production telemetry endpoint
3. Create dashboards for monitoring
4. Add custom business metrics