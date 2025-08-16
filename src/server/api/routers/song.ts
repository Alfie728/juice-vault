// import { EmbeddingsService } from "~/domain/ai/embeddings-service"; // Commented out - no embeddings
// import { client } from "~/jobs/client"; // Commented out - no background jobs for embeddings
import { TRPCError } from "@trpc/server";
import { Effect } from "effect";
import { z } from "zod";

import { SongService } from "~/domain/song/service";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

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
            ValidationError: (error) =>
              Effect.fail(
                new TRPCError({
                  code: "BAD_REQUEST",
                  message: error.message,
                })
              ),
            DatabaseError: (error) =>
              Effect.fail(
                new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: error.message,
                })
              ),
          })
        )
      );
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        const songService = yield* SongService;
        return yield* songService.getSong(input.id);
      }).pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: error.message,
              })
            ),
          NotFoundError: (error) =>
            Effect.fail(
              new TRPCError({
                code: "NOT_FOUND",
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

      return ctx.runtime.runPromise(program);
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const program = Effect.gen(function* () {
      const songService = yield* SongService;
      return yield* songService.getAllSongs();
    }).pipe(
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

    return ctx.runtime.runPromise(program);
  }),

  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        type: z.enum(["text", "semantic", "hybrid"]).default("text"), // Default to text search only
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        // For now, only use text search regardless of type
        // Semantic and hybrid search disabled until embeddings are configured
        const songService = yield* SongService;
        return yield* songService.searchSongs(input.query);

        /* Commented out - requires EmbeddingsService and Upstash Vector
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
        */
      }).pipe(
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

      return ctx.runtime.runPromise(program);
    }),

  incrementPlayCount: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const program = Effect.gen(function* () {
        const songService = yield* SongService;
        return yield* songService.incrementPlayCount(input.id);
      }).pipe(
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

      return ctx.runtime.runPromise(program);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const program = Effect.gen(function* () {
        const songService = yield* SongService;
        const song = yield* songService.getSong(input.id);

        if (song.uploadedById !== ctx.session.user.id) {
          yield* Effect.fail(
            new TRPCError({
              code: "FORBIDDEN",
              message: "You can only delete your own songs",
            })
          );
        }

        return yield* songService.deleteSong(input.id);
      }).pipe(
        Effect.catchTags({
          NotFoundError: (error) =>
            Effect.fail(
              new TRPCError({
                code: "NOT_FOUND",
                message: error.message,
              })
            ),
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

      return ctx.runtime.runPromise(program);
    }),

  getUserSongs: protectedProcedure.query(async ({ ctx }) => {
    const program = Effect.gen(function* () {
      const songService = yield* SongService;
      const allSongs = yield* songService.getAllSongs();
      return allSongs.filter(
        (song) => song.uploadedById === ctx.session.user.id
      );
    }).pipe(
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

    return ctx.runtime.runPromise(program);
  }),
});
