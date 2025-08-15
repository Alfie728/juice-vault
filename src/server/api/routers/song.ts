import { z } from "zod";
import { Effect } from "effect";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { SongService } from "~/domain/song/service";
import { EmbeddingsService } from "~/domain/ai/embeddings-service";
import { client } from "~/jobs/client";
import { TRPCError } from "@trpc/server";

export const songRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        artist: z.string().default("Juice WRLD"),
        audioUrl: z.string().url(),
        duration: z.number().optional(),
        coverArtUrl: z.string().url().optional(),
        releaseDate: z.date().optional(),
        isUnreleased: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const program = Effect.gen(function* () {
        const songService = yield* SongService;
        
        const song = yield* songService.createSong({
          ...input,
          uploadedBy: { id: ctx.session.user.id },
        });

        return song;
      });

      return await Effect.runPromise(
        program.pipe(
          Effect.provide(SongService.Default),
          Effect.catchTags({
            ValidationError: (error) => Effect.fail(new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            })),
            DatabaseError: (error) => Effect.fail(new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: error.message,
            })),
          }),
          Effect.catchAll((error) => Effect.fail(new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Unknown error",
          })))
        )
      );
    }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const program = Effect.gen(function* () {
        const songService = yield* SongService;
        return yield* songService.getSong(input.id);
      });

      return await Effect.runPromise(
        program.pipe(
          Effect.provide(SongService.Default),
          Effect.catchTags({
            NotFoundError: (error) => Effect.fail(new TRPCError({
              code: "NOT_FOUND",
              message: error.message,
            })),
            ValidationError: (error) => Effect.fail(new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            })),
            DatabaseError: (error) => Effect.fail(new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: error.message,
            })),
          })
        )
      );
    }),

  getWithLyrics: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const program = Effect.gen(function* () {
        const songService = yield* SongService;
        return yield* songService.getSongWithLyrics(input.id);
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(SongService.Default))
      ).catch((error) => {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: error.message,
        });
      });

      return result;
    }),

  list: publicProcedure.query(async () => {
    const program = Effect.gen(function* () {
      const songService = yield* SongService;
      return yield* songService.getAllSongs();
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(SongService.Default))
    );

    return result;
  }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        type: z.enum(["text", "semantic", "hybrid"]).default("hybrid"),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const program = Effect.gen(function* () {
        if (input.type === "text") {
          const songService = yield* SongService;
          return yield* songService.searchSongs(input.query);
        } else if (input.type === "semantic") {
          const embeddingsService = yield* EmbeddingsService;
          const result = yield* embeddingsService.semanticSearch({
            query: input.query,
            limit: input.limit,
          });
          return result.songs;
        } else {
          const embeddingsService = yield* EmbeddingsService;
          return yield* embeddingsService.hybridSearch(input.query, input.limit);
        }
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(SongService.Default),
          Effect.provide(EmbeddingsService.Default)
        )
      );

      return result;
    }),

  incrementPlayCount: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const program = Effect.gen(function* () {
        const songService = yield* SongService;
        return yield* songService.incrementPlayCount(input.id);
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(SongService.Default))
      );

      return result;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const program = Effect.gen(function* () {
        const songService = yield* SongService;
        const song = yield* songService.getSong(input.id);
        
        if (song.uploadedById !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only delete your own songs",
          });
        }
        
        return yield* songService.deleteSong(input.id);
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(SongService.Default))
      );

      return result;
    }),

  getUserSongs: protectedProcedure.query(async ({ ctx }) => {
    const program = Effect.gen(function* () {
      const songService = yield* SongService;
      const allSongs = yield* songService.getAllSongs();
      return allSongs.filter(song => song.uploadedById === ctx.session.user.id);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(SongService.Default))
    );

    return result;
  }),
});