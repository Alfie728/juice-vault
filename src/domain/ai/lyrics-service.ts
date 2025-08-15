import { openai } from "@ai-sdk/openai";
import { Schema } from "@effect/schema";
import { generateObject, experimental_transcribe as transcribe } from "ai";
import { Effect, pipe, Schedule } from "effect";
import { z } from "zod";

import { AiError } from "~/domain/ai/errors";
import { ValidationError } from "~/domain/errors";

export const LyricLine = Schema.Struct({
  text: Schema.String,
  startTime: Schema.Number,
  endTime: Schema.optional(Schema.Number),
});

export type LyricLine = Schema.Schema.Type<typeof LyricLine>;

export const GenerateLyricsInput = Schema.Struct({
  audioUrl: Schema.String,
  songTitle: Schema.String,
  artist: Schema.String,
  duration: Schema.optional(Schema.Number),
});

export type GenerateLyricsInput = Schema.Schema.Type<
  typeof GenerateLyricsInput
>;

export const SyncLyricsInput = Schema.Struct({
  audioUrl: Schema.String,
  fullLyrics: Schema.String,
  duration: Schema.optional(Schema.Number),
});

export type SyncLyricsInput = Schema.Schema.Type<typeof SyncLyricsInput>;

export class LyricsAIService extends Effect.Service<LyricsAIService>()(
  "LyricsAIService",
  {
    effect: Effect.gen(function* () {
      const transcriptionModel = openai.transcription("whisper-1");
      const generationModel = openai("gpt-4o");

      return {
        generateLyrics: (input: GenerateLyricsInput) =>
          pipe(
            Schema.decodeUnknown(GenerateLyricsInput)(input),
            Effect.mapError(
              (error) =>
                new ValidationError({
                  field: "generateLyricsInput",
                  reason: String(error),
                })
            ),
            Effect.flatMap((validInput) =>
              Effect.tryPromise({
                try: async () => {
                  const { text } = await transcribe({
                    model: transcriptionModel,
                    audio: validInput.audioUrl,
                  });

                  return text;
                },
                catch: (error) =>
                  new AiError({
                    cause: error,
                    description: `Failed to generate lyrics: ${String(error)}`,
                    method: "generateLyrics",
                    module: "lyrics-service",
                  }),
              })
            ),
            Effect.withSpan("generateLyrics"),
            Effect.retry(Schedule.exponential("600 millis"))
          ),

        syncLyricsWithTimestamps: (input: SyncLyricsInput) =>
          pipe(
            Schema.decodeUnknown(SyncLyricsInput)(input),
            Effect.mapError(
              (error) =>
                new ValidationError({
                  field: "syncLyricsInput",
                  reason: String(error),
                })
            ),
            Effect.flatMap((validInput) =>
              Effect.tryPromise({
                try: async () => {
                  const lines = validInput.fullLyrics
                    .split("\n")
                    .filter((line) => line.trim());
                  const averageTimePerLine = validInput.duration
                    ? validInput.duration / lines.length
                    : 3;

                  const prompt = `
                  Given these lyrics, estimate reasonable timestamps for each line.
                  Each line should have a start time in seconds.
                  ${validInput.duration ? `Total song duration: ${validInput.duration} seconds` : ""}
                  Average time per line: ${averageTimePerLine} seconds

                  Lyrics:
                  ${validInput.fullLyrics}

                  Consider natural pauses, chorus repetitions, and typical song structure.
                  Return timestamps that feel natural for the flow of the song.
                `;

                  const { object } = await generateObject({
                    model: generationModel,
                    prompt,
                    schema: z.object({
                      lines: z.array(
                        z.object({
                          text: z.string(),
                          startTime: z.number(),
                          endTime: z.number().optional(),
                        })
                      ),
                    }),
                  });

                  return object.lines as LyricLine[];
                },
                catch: (error) =>
                  new AiError({
                    method: "generateLyrics",
                    module: "lyrics-service",
                    cause: error,
                    description: `Failed to generate lyrics: ${String(error)}`,
                  }),
              })
            ),
            Effect.withSpan("syncLyricsWithTimestamps"),
            Effect.retry(Schedule.exponential("600 millis")),
            Effect.withSpan("syncLyricsWithTimestampsRetry")
          ),

        improveTimestamps: (
          lines: LyricLine[],
          audioAnalysis?: { beats?: number[]; tempo?: number }
        ) =>
          Effect.try({
            try: () => {
              if (!audioAnalysis?.beats) {
                return lines;
              }

              return lines.map((line, index) => {
                const nearestBeat = audioAnalysis.beats?.reduce((prev, curr) =>
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
            },
            catch: (error) =>
              new ValidationError({
                field: "improveTimestamps",
                reason: String(error),
              }),
          }),
      };
    }),
    accessors: true,
  }
) {}
