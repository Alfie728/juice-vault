import { NodeSdk } from "@effect/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { 
  ConsoleSpanExporter,
  BatchSpanProcessor 
} from "@opentelemetry/sdk-trace-base";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { Effect, Layer, pipe, Console } from "effect";
import { LyricsAIService } from "./lyrics-service";

// Create Jaeger exporter (assuming Jaeger is running on default ports)
const JaegerTracer = Layer.unwrapEffect(
  Effect.gen(function* () {
    // OTLP exporter for Jaeger (default endpoint)
    const otlpExporter = new OTLPTraceExporter({
      url: "http://localhost:4318/v1/traces", // Jaeger OTLP endpoint
      headers: {},
    });
    
    // Also add console exporter for immediate feedback
    const consoleExporter = new ConsoleSpanExporter();
    
    // Create processors
    const otlpProcessor = new BatchSpanProcessor(otlpExporter);
    const consoleProcessor = new BatchSpanProcessor(consoleExporter);
    
    return NodeSdk.layer(() => ({
      resource: {
        serviceName: "juice-vault-lyrics",
        serviceVersion: "1.0.0",
        attributes: {
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: "test",
        },
      },
      spanProcessors: [otlpProcessor, consoleProcessor],
    }));
  })
);

// Enhanced test workflow with more detailed tracing
const testLyricsWorkflow = Effect.gen(function* () {
  const lyricsService = yield* LyricsAIService;
  
  // You can replace this with a real audio URL from your S3 bucket
  const testInput = {
    audioUrl: "https://your-s3-bucket.s3.amazonaws.com/test-audio.mp3", // Replace with real URL
    songTitle: "Lucid Dreams",
    artist: "Juice WRLD",
    duration: 239, // 3:59
  };
  
  yield* Console.log("🎵 Starting Lyrics Generation Workflow");
  yield* Console.log(`📝 Processing: ${testInput.artist} - ${testInput.songTitle}`);
  
  // Step 1: Generate lyrics from audio
  const lyrics = yield* pipe(
    lyricsService.generateLyrics(testInput),
    Effect.withSpan("generate-lyrics-from-audio", {
      attributes: {
        "song.title": testInput.songTitle,
        "song.artist": testInput.artist,
        "song.duration": testInput.duration,
        "audio.url": testInput.audioUrl,
      },
    }),
    Effect.tap((result) => Console.log(`✅ Generated ${result.split('\n').length} lines of lyrics`)),
    Effect.tapError((error) => Console.error(`❌ Failed to generate lyrics: ${String(error)}`))
  );
  
  // Step 2: Sync lyrics with timestamps
  const syncedLyrics = yield* pipe(
    lyricsService.syncLyricsWithTimestamps({
      audioUrl: testInput.audioUrl,
      fullLyrics: lyrics,
      duration: testInput.duration,
    }),
    Effect.withSpan("sync-lyrics-timestamps", {
      attributes: {
        "lyrics.lines": lyrics.split('\n').length,
        "song.duration": testInput.duration,
      },
    }),
    Effect.tap((result) => Console.log(`✅ Synced ${result.length} lines with timestamps`)),
    Effect.tapError((error) => Console.error(`❌ Failed to sync timestamps: ${String(error)}`))
  );
  
  // Step 3: Improve timestamps (simulate with mock beat data)
  const mockAudioAnalysis = {
    beats: Array.from({ length: 100 }, (_, i) => i * 2.39), // Mock beat every 2.39 seconds
    tempo: 100,
  };
  
  const improvedLyrics = yield* pipe(
    lyricsService.improveTimestamps(syncedLyrics, mockAudioAnalysis),
    Effect.withSpan("improve-timestamps", {
      attributes: {
        "beats.count": mockAudioAnalysis.beats.length,
        "tempo": mockAudioAnalysis.tempo,
      },
    }),
    Effect.tap(() => Console.log(`✅ Improved timestamps with beat alignment`))
  );
  
  // Log results
  yield* Console.log("\n📊 === Final Results ===");
  yield* Console.log(`Total lines: ${improvedLyrics.length}`);
  
  // Sample output (first 5 lines)
  const sampleLines = improvedLyrics.slice(0, 5);
  yield* Console.log("\n🎤 Sample lyrics with timestamps:");
  for (const line of sampleLines) {
    yield* Console.log(
      `  [${line.startTime.toFixed(2)}s - ${line.endTime?.toFixed(2) ?? "?"}s] ${line.text}`
    );
  }
  
  return {
    success: true,
    totalLines: improvedLyrics.length,
    lyrics: improvedLyrics,
  };
});

// Main runner with proper error handling
const runJaegerTest = async () => {
  console.log("🚀 Starting Lyrics Service Test with Jaeger Tracing");
  console.log("📡 Make sure Jaeger is running at http://localhost:16686");
  console.log("   You can start Jaeger with: docker run -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest\n");
  
  const program = pipe(
    testLyricsWorkflow,
    Effect.provide(LyricsAIService.Default),
    Effect.provide(JaegerTracer),
    Effect.withSpan("lyrics-test-workflow", {
      attributes: {
        "test.type": "integration",
        "test.component": "lyrics-ai-service",
      },
    }),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Console.error(`Test failed with error: ${String(error)}`);
        return {
          success: false,
          error: String(error),
        };
      })
    )
  );
  
  try {
    const result = await Effect.runPromise(program);
    console.log("\n✨ Test completed successfully!");
    console.log("📊 View traces at: http://localhost:16686");
    return result;
  } catch (error) {
    console.error("💥 Unexpected error:", error);
    throw error;
  }
};

// CLI runner
import { fileURLToPath } from "url";
import { argv } from "process";

if (argv[1] === fileURLToPath(import.meta.url)) {
  runJaegerTest()
    .then((result) => {
      console.log("\n📋 Final Result:", JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Test failed:", error);
      process.exit(1);
    });
}

export { runJaegerTest, testLyricsWorkflow };