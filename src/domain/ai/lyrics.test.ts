/**
 * Lyrics Service Test with OpenTelemetry Tracing
 *
 * To use this test:
 * 1. Add a test audio file (MP3, WAV, etc.) to your project
 * 2. Update the audioUrl path in testInput below
 * 3. Make sure OPENAI_API_KEY is set in your .env file
 * 4. Run: pnpm test:lyrics
 *
 * Note: The audio file will be transcribed using OpenAI Whisper,
 * then lyrics will be synced with timestamps using GPT-4.
 */

import * as fs from "fs";
import * as path from "path";
import { argv } from "process";
// Run the test if this file is executed directly
import { fileURLToPath } from "url";
import { NodeSdk } from "@effect/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { config } from "dotenv";
import { Effect, pipe } from "effect";

import { LyricsAIService } from "./lyrics-service";

// Load environment variables
config();

// Following the tutorial exactly from https://effect.website/docs/observability/tracing/#tutorial-visualizing-traces
const NodeSdkLive = NodeSdk.layer(() => ({
  resource: {
    serviceName: "lyrics-test-service",
  },
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: "http://localhost:4318/v1/traces",
    })
  ),
}));

// Test workflow
const testGenerateLyrics = Effect.gen(function* () {
  const lyricsService = yield* LyricsAIService;

  // Read the local audio file
  const audioFilePath = path.resolve(
    "./src/domain/ai/Juice WRLD - Outer Space (Unreleased song).mp3"
  );

  console.log("Starting lyrics generation test...");
  console.log("Audio file:", audioFilePath);

  // Check if file exists
  if (!fs.existsSync(audioFilePath)) {
    console.error("❌ Audio file not found:", audioFilePath);
    return { success: false, error: "Audio file not found" };
  }

  const audioBuffer = fs.readFileSync(audioFilePath);
  console.log(
    "File size:",
    (audioBuffer.length / 1024 / 1024).toFixed(2),
    "MB"
  );

  // Pass the Buffer directly - the service will handle it
  const testInput = {
    audioUrl: audioBuffer, // Buffer is now properly typed
    songTitle: "Outer Space",
    artist: "Juice WRLD",
    duration: 180, // 3 minutes
  };

  console.log("Song:", testInput.songTitle, "by", testInput.artist);

  try {
    // Test generateLyrics with actual audio transcription
    console.log("\n🎵 Transcribing audio with OpenAI Whisper...");
    const lyrics = yield* lyricsService.generateLyrics(testInput);
    console.log("\n=== Generated Lyrics from Audio ===");
    console.log(lyrics);

    // Test syncLyricsWithTimestamps with the transcribed lyrics
    if (lyrics) {
      const syncInput = {
        audioUrl: "mock-url", // Not actually used in sync
        fullLyrics: lyrics,
        duration: testInput.duration,
      };

      const syncedLyrics =
        yield* lyricsService.syncLyricsWithTimestamps(syncInput);
      console.log("\n=== Synced Lyrics with Timestamps ===");
      syncedLyrics.forEach((line) => {
        console.log(`[${line.startTime.toFixed(2)}s] ${line.text}`);
      });

      // Test improveTimestamps (without audio analysis for now)
      const improvedLyrics =
        yield* lyricsService.improveTimestamps(syncedLyrics);
      console.log("\n=== Improved Timestamps ===");
      improvedLyrics.forEach((line) => {
        console.log(
          `[${line.startTime.toFixed(2)}s - ${line.endTime?.toFixed(2) ?? "?"}s] ${line.text}`
        );
      });
    }

    return { success: true, lyrics };
  } catch (error) {
    console.error("Error during test:", error);
    return { success: false, error };
  }
});

// Main function to run the test
const runTest = async () => {
  console.log("Setting up OpenTelemetry tracing...\n");
  console.log(
    "📊 Traces will be sent to Grafana Tempo at http://localhost:3001"
  );
  console.log(
    '   Navigate to Explore → Tempo → Search for service.name="lyrics-test-service"\n'
  );

  const program = pipe(
    testGenerateLyrics,
    Effect.withSpan("test-lyrics-generation", {
      attributes: {
        "test.type": "lyrics",
        "test.service": "LyricsAIService",
      },
    }),
    Effect.provide(LyricsAIService.Default),
    Effect.provide(NodeSdkLive)
  );

  const result = await Effect.runPromise(program);
  console.log("\n=== Test Result ===");
  console.log(result);

  // Give time for traces to be sent
  console.log("\n⏳ Waiting for traces to be sent to Tempo...");
  await new Promise((resolve) => setTimeout(resolve, 5000));
  console.log("✅ Traces should now be visible in Grafana Tempo!");
  console.log("\n🔍 Query suggestions:");
  console.log("   1. Try an empty query: {}");
  console.log("   2. Check time range is set to 'Last 5 minutes'");
  console.log("   3. In Search tab, look for service: lyrics-test-service");
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY is not set in environment variables");
    console.error("   Please set it in your .env file");
    process.exit(1);
  }

  runTest().catch(console.error);
}

export { runTest, testGenerateLyrics };
