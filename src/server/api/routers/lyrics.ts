import { TRPCError } from "@trpc/server";
import { Effect, Schedule } from "effect";
import { z } from "zod";

import { AiError } from "~/domain/ai/errors";
import { LyricsAIService } from "~/domain/ai/lyrics-ai-service";
import { LyricsService } from "~/domain/lyrics/service";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const lyricsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        songId: z.string(),
        fullText: z.string().min(1),
        isGenerated: z.boolean().default(false),
        lines: z
          .array(
            z.object({
              text: z.string(),
              startTime: z.number(),
              endTime: z.number().optional(),
              orderIndex: z.number(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        const lyricsService = yield* LyricsService;

        return yield* lyricsService.createLyrics(input);
      }).pipe(
        Effect.catchTags({
          ValidationError: (error) => {
            return Effect.fail(
              new TRPCError({
                code: "BAD_REQUEST",
                message: error.message,
              })
            );
          },
          DatabaseError: (error) => {
            return Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error.message,
              })
            );
          },
        })
      );

      return ctx.runtime.runPromise(program);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        fullText: z.string().optional(),
        isVerified: z.boolean().optional(),
        lines: z
          .array(
            z.object({
              text: z.string(),
              startTime: z.number(),
              endTime: z.number().optional(),
              orderIndex: z.number(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        const lyricsService = yield* LyricsService;

        return yield* lyricsService.updateLyrics(input);
      }).pipe(
        Effect.catchTags({
          DatabaseError: (error) => {
            return Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error.message,
              })
            );
          },
          ValidationError: (error) => {
            return Effect.fail(
              new TRPCError({
                code: "BAD_REQUEST",
                message: error.message,
              })
            );
          },
        })
      );

      return ctx.runtime.runPromise(program);
    }),

  getBySongId: protectedProcedure
    .input(z.object({ songId: z.string() }))
    .query(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        const lyricsService = yield* LyricsService;
        return yield* lyricsService.getLyricsBySongId(input.songId);
      }).pipe(
        Effect.catchTags({
          DatabaseError: (error) => {
            return Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error.message,
              })
            );
          },
        })
      );

      return ctx.runtime.runPromise(program);
    }),

  generateLyrics: protectedProcedure
    .input(
      z.object({
        songId: z.string(),
        audioUrl: z.string().url(),
        songTitle: z.string(),
        artist: z.string().default("Juice WRLD"),
        duration: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        const lyricsService = yield* LyricsService;
        const lyricsAI = yield* LyricsAIService;

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

        // First, fetch the audio file from the URL
        const audioResponse = yield* Effect.tryPromise({
          try: async () => {
            const response = await fetch(input.audioUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch audio: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
          },
          catch: (error) =>
            new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Failed to fetch audio file: ${String(error)}`,
            }),
        });

        // Generate lyrics using AI transcription with retry logic
        const transcribedText = yield* lyricsAI
          .generateLyrics({
            audioUrl: audioResponse,
            songTitle: input.songTitle,
            artist: input.artist,
            duration: input.duration,
          })
          .pipe(
            // Retry with exponential backoff starting at 1 second, max 5 attempts
            // Only retry for AI-related errors (network, API limits, etc.)
            Effect.retry({
              schedule: Schedule.exponential("1 second"),
              while: (error) => error._tag === "AiError", // More idiomatic for tagged errors
              times: 5,
            }),
            // Log errors during retry
            Effect.tapError((error) =>
              Effect.sync(() =>
                console.error(
                  "Lyrics generation attempt failed, retrying:",
                  error
                )
              )
            ),
            // If all retries fail, fall back to a simple message
            Effect.orElse(() =>
              Effect.succeed(`${input.songTitle} by ${input.artist}

[Instrumental]

This track appears to be instrumental or the lyrics could not be transcribed.
You can edit this to add lyrics manually if needed.`)
            )
          );

        // Save the lyrics to database
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
      }).pipe(
        Effect.catchTags({
          DatabaseError: (error: { message: string }) =>
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

  syncLyrics: protectedProcedure
    .input(
      z.object({
        songId: z.string(),
        lyricsId: z.string().optional(),
        audioUrl: z.string().url(),
        fullLyrics: z.string(),
        duration: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        const lyricsService = yield* LyricsService;
        const lyricsAI = yield* LyricsAIService;

        // Generate timestamps for the lyrics with retry logic
        const syncedLines = yield* lyricsAI
          .syncLyricsWithTimestamps({
            audioUrl: input.audioUrl,
            fullLyrics: input.fullLyrics,
            duration: input.duration,
          })
          .pipe(
            // Retry with exponential backoff, max 5 attempts for AI errors
            Effect.retry({
              schedule: Schedule.exponential("1 second"),
              while: (error) => error._tag === "AiError", // Check for AI-specific errors
              times: 5,
            }),
            // Log errors during retry
            Effect.tapError((error) =>
              Effect.sync(() =>
                console.error("Sync attempt failed, retrying:", error)
              )
            ),
            // If all retries fail, generate simple evenly-spaced timestamps
            Effect.orElse(() => {
              const lines = input.fullLyrics
                .split("\n")
                .filter((line) => line.trim());
              const duration = input.duration ?? 180; // Default 3 minutes if no duration
              const timePerLine = duration / Math.max(lines.length, 1);

              return Effect.succeed(
                lines.map((text, index) => ({
                  text,
                  startTime: index * timePerLine,
                  endTime: (index + 1) * timePerLine,
                }))
              );
            })
          );

        // Update the lyrics with the synced lines
        if (input.lyricsId) {
          yield* lyricsService.updateLyrics({
            id: input.lyricsId,
            lines: syncedLines.map((line, index) => ({
              text: line.text,
              startTime: line.startTime,
              endTime: line.endTime,
              orderIndex: index,
            })),
          });
        }

        return {
          success: true,
          message: "Lyrics synchronized successfully",
          songId: input.songId,
        };
      }).pipe(
        Effect.catchTags({
          DatabaseError: (error: { message: string }) =>
            Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error.message,
              })
            ),
          ValidationError: (error: { reason: string }) =>
            Effect.fail(
              new TRPCError({
                code: "BAD_REQUEST",
                message: error.reason,
              })
            ),
        })
      );

      return ctx.runtime.runPromise(program);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        const lyricsService = yield* LyricsService;
        return yield* lyricsService.deleteLyrics(input.id);
      }).pipe(
        Effect.catchTags({
          DatabaseError: (error) => {
            return Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error.message,
              })
            );
          },
        })
      );

      return ctx.runtime.runPromise(program);
    }),

  syncLyricLines: protectedProcedure
    .input(
      z.object({
        lyricsId: z.string(),
        lines: z.array(
          z.object({
            text: z.string(),
            startTime: z.number(),
            endTime: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        const lyricsService = yield* LyricsService;
        return yield* lyricsService.syncLyricLines(input.lyricsId, input.lines);
      }).pipe(
        Effect.catchTags({
          DatabaseError: (error) => {
            return Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error.message,
              })
            );
          },
        })
      );

      return ctx.runtime.runPromise(program);
    }),
});
