import { openai } from "@ai-sdk/openai";
import { Schema } from "@effect/schema";
import { experimental_transcribe as transcribe } from "ai";
import { Effect, pipe, Schedule } from "effect";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

import { AiError } from "~/domain/ai/errors";
import { ValidationError } from "~/domain/errors";

export const LyricLine = Schema.Struct({
  text: Schema.String,
  startTime: Schema.Number,
  endTime: Schema.optional(Schema.Number),
});

export type LyricLine = Schema.Schema.Type<typeof LyricLine>;

// Define a union type for accepted audio input formats
export const AudioData = Schema.Union(
  Schema.String, // URL or base64 string
  Schema.instanceOf(Buffer), // Node.js Buffer
  Schema.instanceOf(Uint8Array), // Uint8Array
  Schema.instanceOf(ArrayBuffer) // ArrayBuffer
);

export type AudioData = Schema.Schema.Type<typeof AudioData>;

export const GenerateLyricsInput = Schema.Struct({
  audioUrl: AudioData,
  songTitle: Schema.String,
  artist: Schema.String,
  duration: Schema.optional(Schema.Number),
});

export type GenerateLyricsInput = Schema.Schema.Type<
  typeof GenerateLyricsInput
>;

export const GenerateLyricsResult = Schema.Struct({
  text: Schema.String,
  lines: Schema.Array(LyricLine),
  language: Schema.optional(Schema.String),
  duration: Schema.optional(Schema.Number),
});

export type GenerateLyricsResult = Schema.Schema.Type<
  typeof GenerateLyricsResult
>;

export class LyricsAIService extends Effect.Service<LyricsAIService>()(
  "LyricsAIService",
  {
    effect: Effect.gen(function* () {
      const transcriptionModel = openai.transcription("whisper-1");

      // Initialize OpenAI client for direct API calls
      const openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      return {
        generateLyrics: (input: GenerateLyricsInput) =>
          pipe(
            // Validation span
            Effect.withSpan(
              Schema.decodeUnknown(GenerateLyricsInput)(input),
              "lyrics.validate_input",
              {
                attributes: {
                  "lyrics.song_title": input.songTitle ?? "unknown",
                  "lyrics.artist": input.artist ?? "unknown",
                  "lyrics.has_duration": Boolean(input.duration),
                },
              }
            ),
            Effect.mapError(
              (error) =>
                new ValidationError({
                  field: "generateLyricsInput",
                  reason: String(error),
                })
            ),
            Effect.flatMap((validInput) =>
              pipe(
                // Audio preparation span
                Effect.withSpan(
                  Effect.try({
                    try: () => {
                      const inputAudioData = validInput.audioUrl;
                      let processedAudioData: Buffer | Uint8Array | ArrayBuffer;
                      let audioSize = 0;
                      let audioFormat = "unknown";

                      if (Buffer.isBuffer(inputAudioData)) {
                        processedAudioData = inputAudioData;
                        audioSize = inputAudioData.length;
                        audioFormat = "buffer";
                      } else if (typeof inputAudioData === "string") {
                        if (inputAudioData.startsWith("http")) {
                          throw new Error(
                            "Direct URL transcription not supported. Please download the file first."
                          );
                        } else if (inputAudioData.includes("base64")) {
                          const base64Data =
                            inputAudioData.split(",")[1] ?? inputAudioData;
                          const bufferData = Buffer.from(base64Data, "base64");
                          processedAudioData = bufferData;
                          audioSize = bufferData.length;
                          audioFormat = "base64";
                        } else {
                          throw new Error("Invalid audio data format");
                        }
                      } else if (inputAudioData instanceof Uint8Array) {
                        processedAudioData = inputAudioData;
                        audioSize = inputAudioData.length;
                        audioFormat = "uint8array";
                      } else if (inputAudioData instanceof ArrayBuffer) {
                        processedAudioData = inputAudioData;
                        audioSize = inputAudioData.byteLength;
                        audioFormat = "arraybuffer";
                      } else {
                        throw new Error(
                          `Unsupported audio data type: ${typeof inputAudioData}`
                        );
                      }

                      return {
                        audioData: processedAudioData,
                        audioSize,
                        audioFormat,
                      };
                    },
                    catch: (error) =>
                      new AiError({
                        cause: error,
                        description: `Failed to prepare audio: ${String(error)}`,
                        method: "generateLyrics",
                        module: "lyrics-service",
                      }),
                  }),
                  "lyrics.prepare_audio"
                ),
                Effect.flatMap(({ audioData, audioSize, audioFormat }) =>
                  // Transcription span with attributes
                  Effect.withSpan(
                    Effect.tryPromise({
                      try: async () => {
                        const startTime = Date.now();

                        // Use OpenAI API directly to get verbose JSON with segments
                        const file = await toFile(audioData, "audio.mp3", {
                          type: "audio/mpeg",
                        });

                        const transcription =
                          await openaiClient.audio.transcriptions.create({
                            file,
                            model: "whisper-1",
                            response_format: "verbose_json",
                            timestamp_granularities: ["segment"] as ["segment"],
                          });

                        const duration = Date.now() - startTime;

                        // Add event for successful transcription
                        Effect.logInfo("Transcription completed", {
                          duration,
                          textLength: transcription.text.length,
                          segmentCount: transcription.segments?.length ?? 0,
                        }).pipe(Effect.runSync);

                        // Convert OpenAI segments to our LyricLine format
                        const segments = transcription.segments;
                        const lines: LyricLine[] =
                          segments && segments.length > 0
                            ? segments.map((segment) => ({
                                text: segment.text.trim(),
                                startTime: segment.start,
                                endTime: segment.end,
                              }))
                            : [];

                        // Return both text and timestamped lines
                        return {
                          text: transcription.text,
                          lines,
                          language: transcription.language,
                          duration: transcription.duration,
                        };
                      },
                      catch: (error) =>
                        new AiError({
                          cause: error,
                          description: `Failed to transcribe audio: ${String(error)}`,
                          method: "generateLyrics",
                          module: "lyrics-service",
                        }),
                    }),
                    "lyrics.transcribe_audio",
                    {
                      attributes: {
                        "lyrics.audio_size_bytes": audioSize,
                        "lyrics.audio_format": audioFormat,
                        "lyrics.model": "whisper-1",
                        "lyrics.song_title": validInput.songTitle,
                        "lyrics.artist": validInput.artist,
                      },
                    }
                  )
                )
              )
            ),
            Effect.withSpan("generateLyrics", {
              attributes: {
                "operation.type": "audio_transcription",
                "ai.model": "whisper-1",
              },
            }),
            Effect.retry(Schedule.exponential("600 millis"))
          ),

        improveTimestamps: (
          lines: LyricLine[],
          audioAnalysis?: { beats?: number[]; tempo?: number }
        ) =>
          Effect.withSpan(
            Effect.try({
              try: () => {
                if (!audioAnalysis?.beats) {
                  Effect.logDebug(
                    "No audio analysis provided, returning original timestamps"
                  ).pipe(Effect.runSync);
                  return lines;
                }

                const improvedLines = lines.map((line, index) => {
                  const nearestBeat = audioAnalysis.beats?.reduce(
                    (prev, curr) =>
                      Math.abs(curr - line.startTime) <
                      Math.abs(prev - line.startTime)
                        ? curr
                        : prev
                  );

                  return {
                    ...line,
                    startTime: nearestBeat ?? line.startTime,
                    endTime: lines[index + 1]?.startTime ?? line.endTime,
                  };
                });

                Effect.logInfo("Timestamps improved with beat alignment", {
                  originalCount: lines.length,
                  beatCount: audioAnalysis.beats?.length ?? 0,
                  tempo: audioAnalysis.tempo ?? 0,
                }).pipe(Effect.runSync);

                return improvedLines;
              },
              catch: (error) =>
                new ValidationError({
                  field: "improveTimestamps",
                  reason: String(error),
                }),
            }),
            "lyrics.improve_timestamps",
            {
              attributes: {
                "lyrics.line_count": lines.length,
                "lyrics.has_audio_analysis": Boolean(audioAnalysis?.beats),
                "lyrics.beat_count": audioAnalysis?.beats?.length ?? 0,
                "lyrics.tempo": audioAnalysis?.tempo ?? 0,
              },
            }
          ),
      };
    }),
    accessors: true,
  }
) {}
