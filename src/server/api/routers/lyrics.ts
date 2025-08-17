import { HttpClient } from "@effect/platform";
import { TRPCError } from "@trpc/server";
import { Effect, Schedule } from "effect";
import { z } from "zod";

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
      // AI transcription program - handles audio fetching and transcription
      const transcribeAudioProgram = Effect.gen(function* () {
        const lyricsAI = yield* LyricsAIService;
        const httpClient = yield* HttpClient.HttpClient;

        // First, fetch the audio file from the URL using Effect's HTTP client
        const response = yield* httpClient.get(input.audioUrl);
        const audioArrayBuffer = yield* response.arrayBuffer;
        const audioBuffer = Buffer.from(audioArrayBuffer);

        // Generate lyrics using AI transcription
        return yield* lyricsAI.generateLyrics({
          audioUrl: audioBuffer,
          songTitle: input.songTitle,
          artist: input.artist,
          duration: input.duration,
        });
      }).pipe(
        // Retry while we are still getting AI errors
        Effect.retry({
          schedule: Schedule.exponential("1 second"),
          while: (error) =>
            error._tag === "AiError" || error._tag === "RequestError",
          times: 3,
        }),
        // Handle specific error types gracefully
        Effect.catchTags({
          ValidationError: (error) => {
            return Effect.fail(
              new TRPCError({
                code: "BAD_REQUEST",
                message: `Validation error: ${error.message}`,
              })
            );
          },
          RequestError: (error) => {
            return Effect.fail(
              new TRPCError({
                code: "BAD_REQUEST",
                message: `Failed to fetch audio file: ${error.message}`,
              })
            );
          },
          ResponseError: (error) => {
            return Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Network error while fetching audio: ${error.message}`,
              })
            );
          },
          AiError: (error) => {
            return Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `AI error while generating lyrics: ${error.message}`,
              })
            );
          },
        }),
        // Add spans for the entire AI operation
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

      // Main lyrics generation program - orchestrates transcription and database operations
      const generateLyricsProgram = Effect.gen(function* () {
        const lyricsService = yield* LyricsService;

        // Check if lyrics already exist
        const existingLyrics = yield* Effect.withSpan(
          lyricsService
            .getLyricsBySongId(input.songId)
            .pipe(Effect.catchAll(() => Effect.succeed(null))),
          "lyrics.check_existing",
          {
            attributes: {
              "lyrics.song_id": input.songId,
            },
          }
        );

        if (existingLyrics) {
          return {
            success: true,
            message: "Lyrics already exist",
            songId: input.songId,
            lyricsId: existingLyrics.id,
          };
        }

        // Get transcribed text and timestamped lines from AI transcription program
        const transcriptionResult = yield* transcribeAudioProgram;

        // Enhanced debug log to check transcription result
        console.log("=== Router: Transcription Result ===");
        console.log("Text length:", transcriptionResult.text?.length ?? 0);
        console.log("Lines count:", transcriptionResult.lines?.length ?? 0);
        console.log("Has timestamps:", (transcriptionResult.lines?.length ?? 0) > 0);
        
        if (transcriptionResult.lines && transcriptionResult.lines.length > 0) {
          console.log("First 3 lines with timestamps:", transcriptionResult.lines.slice(0, 3));
        }
        
        // Save the lyrics to database with timestamped lines
        const lyrics = yield* Effect.withSpan(
          lyricsService.createLyrics({
            songId: input.songId,
            fullText: transcriptionResult.text,
            isGenerated: true,
            lines: transcriptionResult.lines && transcriptionResult.lines.length > 0
              ? transcriptionResult.lines.map((line, index) => ({
                  text: line.text,
                  startTime: line.startTime,
                  endTime: line.endTime,
                  orderIndex: index,
                }))
              : undefined,
          }),
          "lyrics.save_to_database",
          {
            attributes: {
              "lyrics.song_id": input.songId,
              "lyrics.is_generated": true,
              "lyrics.text_length": transcriptionResult.text.length,
              "lyrics.lines_count": transcriptionResult.lines?.length ?? 0,
              "lyrics.has_timestamps": (transcriptionResult.lines?.length ?? 0) > 0,
              "lyrics.language": transcriptionResult.language ?? "unknown",
              "lyrics.duration": transcriptionResult.duration ?? 0,
            },
          }
        );

        return {
          success: true,
          message: "Lyrics generated successfully",
          songId: input.songId,
          lyricsId: lyrics.id,
        };
      }).pipe(
        Effect.withSpan("lyrics.generateLyrics", {
          attributes: {
            "operation.type": "generate_lyrics",
            "song.id": input.songId,
            "song.title": input.songTitle,
          },
        }),
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

      return ctx.runtime.runPromise(generateLyricsProgram);
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
