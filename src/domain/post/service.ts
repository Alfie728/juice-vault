import { Schema } from "@effect/schema";
import { Effect, pipe } from "effect";

import { DatabaseError, NotFoundError, ValidationError } from "~/domain/errors";
import { PrismaClientService } from "~/lib/prisma";

import { PrismaPostToPost, PrismaPostWithUserToPostWithUser } from "./mapping";
import { PostWithUserQuery } from "./query";

/**
 * Input schema for creating posts using Effect Schema
 * Provides runtime validation and type inference
 */
export const CreatePostInput = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Post name cannot be empty" })
  ),
  createdBy: Schema.Struct({
    id: Schema.String,
  }),
});

export type CreatePostInput = Schema.Schema.Type<typeof CreatePostInput>;

/**
 * PostService provides all post-related operations with type-safe error handling.
 *
 * Benefits of using Effect.Service:
 * - Automatic dependency injection (Database is injected automatically)
 * - Type-safe error handling (all errors are explicit in return types)
 * - Testability (can be easily mocked using PostService.Test)
 * - Composability (can be combined with other services in layers)
 *
 * @example
 * // In Effect programs
 * Effect.gen(function* () {
 *   const service = yield* PostService
 *   const post = yield* service.createPost(input)
 * })
 */
export class PostService extends Effect.Service<PostService>()("PostService", {
  dependencies: [PrismaClientService.Default],
  effect: Effect.gen(function* () {
    const db = yield* PrismaClientService;

    return {
      /**
       * Creates a new post with validation
       * @throws {ValidationError} If input validation fails
       * @throws {DatabaseError} If database operation fails
       */
      createPost: (input: CreatePostInput) =>
        pipe(
          Schema.decodeUnknown(CreatePostInput)(input),
          Effect.mapError(
            (error) =>
              new ValidationError({
                field: "createPostInput",
                reason: String(error),
              })
          ),
          Effect.flatMap((validInput) =>
            Effect.tryPromise({
              try: () =>
                db.post.create({
                  data: {
                    name: validInput.name,
                    createdBy: { connect: { id: validInput.createdBy.id } },
                  },
                }),
              catch: (error) =>
                new DatabaseError({
                  operation: "createPost",
                  reason: String(error),
                }),
            })
          ),
          Effect.flatMap(PrismaPostToPost)
        ),

      /**
       * Retrieves the most recent post with user information
       * @returns Post with user or null if no posts exist
       * @throws {DatabaseError} If database query fails
       */
      getLatestPost: () =>
        pipe(
          Effect.tryPromise({
            try: () =>
              db.post.findFirst({
                orderBy: { createdAt: "desc" },
                include: PostWithUserQuery.include,
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "getLatestPost",
                reason: String(error),
              }),
          }),
          Effect.flatMap((post) =>
            post ? PrismaPostWithUserToPostWithUser(post) : Effect.succeed(null)
          )
        ),

      /**
       * Retrieves a specific post by ID
       * @throws {NotFoundError} If post doesn't exist
       * @throws {DatabaseError} If database query fails
       * @throws {ValidationError} If ID format is invalid
       */
      getPost: (id: string) =>
        pipe(
          Effect.tryPromise({
            try: () =>
              db.post.findUnique({
                where: { id: Number(id) },
                include: PostWithUserQuery.include,
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "getPost",
                reason: String(error),
              }),
          }),
          Effect.flatMap((post) =>
            post
              ? PrismaPostWithUserToPostWithUser(post)
              : Effect.fail<NotFoundError | ValidationError | DatabaseError>(
                  new NotFoundError({
                    resource: "Post",
                    id,
                  })
                )
          )
        ),

      /**
       * Retrieves all posts ordered by creation date
       * @throws {DatabaseError} If database query fails
       * @throws {ValidationError} If data transformation fails
       */
      getAllPosts: () =>
        pipe(
          Effect.tryPromise({
            try: () =>
              db.post.findMany({
                orderBy: { createdAt: "desc" },
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "getAllPosts",
                reason: String(error),
              }),
          }),
          Effect.flatMap((posts) => Effect.all(posts.map(PrismaPostToPost)))
        ),
    };
  }),
  accessors: true,
}) {}
