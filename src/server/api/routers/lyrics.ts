import { TRPCError } from "@trpc/server";
import { Effect } from "effect";
import { z } from "zod";

import { LyricsAIService } from "~/domain/ai/lyrics-ai-service";
import { LyricsService } from "~/domain/lyrics/service";
import { client } from "~/jobs/client";
import { generateLyricsJob } from "~/jobs/lyrics-generation";
import { syncLyricsJob } from "~/jobs/lyrics-sync";
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

        // Generate lyrics using AI transcription with fallback
        const transcribedText = yield* lyricsAI
          .generateLyrics({
            audioUrl: audioResponse,
            songTitle: input.songTitle,
            artist: input.artist,
            duration: input.duration,
          })
          .pipe(
            Effect.catchAll(() => {
              // If AI fails, create placeholder lyrics as fallback
              return Effect.succeed(`${input.songTitle} by ${input.artist}

[Lyrics transcription failed]

The audio transcription service encountered an error.
You can edit this to add the lyrics manually.`);
            })
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
        yield* Effect.tryPromise({
          try: () =>
            client.sendEvent({
              name: "song.lyrics.sync",
              payload: input,
            }),
          catch: (error) =>
            new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Failed to start lyrics sync job: ${String(error)}`,
            }),
        });

        return {
          success: true,
          message: "Lyrics sync job started",
          songId: input.songId,
        };
      });

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
