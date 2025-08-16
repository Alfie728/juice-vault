import { TRPCError } from "@trpc/server";
import { Effect } from "effect";
import { z } from "zod";

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
        yield* Effect.tryPromise({
          try: () =>
            client.sendEvent({
              name: "song.lyrics.generate",
              payload: input,
            }),
          catch: (error) =>
            new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Failed to start lyrics generation job: ${String(error)}`,
            }),
        });

        return {
          success: true,
          message: "Lyrics generation job started",
          songId: input.songId,
        };
      });

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
