import { TRPCError } from "@trpc/server";
import { Effect } from "effect";
import { z } from "zod";

import { PostService } from "~/domain/post/service";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const program = Effect.gen(function* () {
        return yield* PostService.createPost({
          name: input.name,
          createdBy: {
            id: ctx.session.user.id,
          },
        });
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

  latest: protectedProcedure.query(async ({ ctx }) => {
    const program = Effect.gen(function* () {
      return yield* PostService.getLatestPost();
    }).pipe(
      Effect.catchTags({
        DatabaseError: () => {
          return Effect.fail(
            new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
            })
          );
        },
        ValidationError: () => {
          return Effect.fail(
            new TRPCError({
              code: "BAD_REQUEST",
            })
          );
        },
      })
    );
    return ctx.runtime.runPromise(program);
  }),

  all: protectedProcedure.query(async ({ ctx }) => {
    const program = Effect.gen(function* () {
      return yield* PostService.getAllPosts();
    }).pipe(
      Effect.catchTags({
        DatabaseError: () => {
          return Effect.fail(
            new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
            })
          );
        },
        ValidationError: () => {
          return Effect.fail(
            new TRPCError({
              code: "BAD_REQUEST",
            })
          );
        },
      })
    );
    return ctx.runtime.runPromise(program);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const program = Effect.gen(function* () {
        return yield* PostService.getPost(input.id);
      }).pipe(
        Effect.catchTags({
          DatabaseError: () => {
            return Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
              })
            );
          },
          ValidationError: () => {
            return Effect.fail(
              new TRPCError({
                code: "BAD_REQUEST",
              })
            );
          },
          NotFoundError: () => {
            return Effect.fail(
              new TRPCError({
                code: "NOT_FOUND",
              })
            );
          },
        })
      );

      return ctx.runtime.runPromise(program);
    }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
