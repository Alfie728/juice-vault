import { openai } from "@ai-sdk/openai";
import { Schema } from "@effect/schema";
import { generateObject, generateText } from "ai";
import { Effect, pipe } from "effect";
import { z } from "zod";

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
      const model = openai("gpt-4o");

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
                  const prompt = `
                  Generate lyrics for a song titled "${validInput.songTitle}" by ${validInput.artist}.
                  This is likely an unreleased Juice WRLD song.
                  ${validInput.duration ? `The song duration is approximately ${validInput.duration} seconds.` : ""}

                  Generate realistic and emotionally resonant lyrics that match Juice WRLD's style:
                  - Themes: love, heartbreak, substance use, mental health, success
                  - Style: melodic, emotional, honest, vulnerable
                  - Include hooks, verses, and bridges

                  Return only the lyrics, with clear verse/chorus/bridge markers.
                `;

                  const { text } = await generateText({
                    model,
                    prompt,
                  });

                  return text;
                },
                catch: (error) =>
                  new ValidationError({
                    field: "generateLyrics",
                    reason: `Failed to generate lyrics: ${String(error)}`,
                  }),
              })
            )
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
                    model,
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
                  new ValidationError({
                    field: "syncLyrics",
                    reason: `Failed to sync lyrics: ${String(error)}`,
                  }),
              })
            )
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
