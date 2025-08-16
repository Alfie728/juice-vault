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
      const program = Effect.gen(function* () {
        const lyricsService = yield* LyricsService;
        const lyricsAI = yield* LyricsAIService;

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

        // First, fetch the audio file from the URL
        const audioResponse = yield* Effect.withSpan(
          Effect.tryPromise({
            try: async () => {
              const response = await fetch(input.audioUrl);
              if (!response.ok) {
                throw new Error(
                  `Failed to fetch audio: ${response.statusText}`
                );
              }
              const arrayBuffer = await response.arrayBuffer();
              return Buffer.from(arrayBuffer);
            },
            catch: (error) =>
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Failed to fetch audio file: ${String(error)}`,
              }),
          }),
          "lyrics.fetch_audio",
          {
            attributes: {
              "audio.url": input.audioUrl,
              "audio.song_title": input.songTitle,
              "audio.artist": input.artist,
            },
          }
        );

        // Generate lyrics using AI transcription with retry logic
        const transcribedText = yield* Effect.withSpan(
          lyricsAI
            .generateLyrics({
              audioUrl: audioResponse,
              songTitle: input.songTitle,
              artist: input.artist,
              duration: input.duration,
            })
            .pipe(
              // Retry until we stop getting AI errors (i.e., until successful)
              Effect.retry({
                schedule: Schedule.exponential("1 second"),
                until: (error) => error._tag !== "AiError",
              })
            ),
          "lyrics.generate_with_retry",
          {
            attributes: {
              "lyrics.song_title": input.songTitle,
              "lyrics.artist": input.artist,
              "lyrics.duration": input.duration ?? 0,
              "lyrics.retry_max_attempts": 5,
              "lyrics.retry_schedule": "exponential_1s",
            },
          }
        );

        // Save the lyrics to database
        const lyrics = yield* Effect.withSpan(
          lyricsService.createLyrics({
            songId: input.songId,
            fullText: transcribedText,
            isGenerated: true,
          }),
          "lyrics.save_to_database",
          {
            attributes: {
              "lyrics.song_id": input.songId,
              "lyrics.is_generated": true,
              "lyrics.text_length": transcribedText.length,
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
        const syncedLines = yield* Effect.withSpan(
          lyricsAI
            .syncLyricsWithTimestamps({
              audioUrl: input.audioUrl,
              fullLyrics: input.fullLyrics,
              duration: input.duration,
            })
            .pipe(
              // Retry until we stop getting AI errors (i.e., until successful)
              Effect.retry({
                schedule: Schedule.exponential("1 second"),
                until: (error) => error._tag !== "AiError",
              })
            ),
          "lyrics.sync_with_retry",
          {
            attributes: {
              "lyrics.full_text_length": input.fullLyrics.length,
              "lyrics.duration": input.duration ?? 180,
              "lyrics.retry_max_attempts": 5,
              "lyrics.retry_schedule": "exponential_1s",
            },
          }
        );

        // Update the lyrics with the synced lines
        if (input.lyricsId) {
          yield* Effect.withSpan(
            lyricsService.updateLyrics({
              id: input.lyricsId,
              lines: syncedLines.map((line, index) => ({
                text: line.text,
                startTime: line.startTime,
                endTime: line.endTime,
                orderIndex: index,
              })),
            }),
            "lyrics.update_with_timestamps",
            {
              attributes: {
                "lyrics.id": input.lyricsId,
                "lyrics.lines_count": syncedLines.length,
              },
            }
          );
        }

        return {
          success: true,
          message: "Lyrics synchronized successfully",
          songId: input.songId,
        };
      }).pipe(
        Effect.withSpan("lyrics.syncLyrics", {
          attributes: {
            "operation.type": "sync_lyrics",
            "song.id": input.songId,
            has_lyrics_id: Boolean(input.lyricsId),
          },
        }),
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
