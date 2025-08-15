import { Schema } from "@effect/schema";

import { UserSchema } from "../user/schema";

/**
 * Post Schema using Effect's Schema
 * Provides runtime validation, encoding/decoding, and type inference
 */
export const PostSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Post name cannot be empty" }),
    Schema.maxLength(255, {
      message: () => "Post name too long (max 255 characters)",
    })
  ),
  createdAt: Schema.instanceOf(Date),
  updatedAt: Schema.instanceOf(Date),
});

/**
 * Post with User relation schema
 * Demonstrates schema composition with Effect Schema
 */
export const PostWithUserSchema = Schema.Struct({
  ...PostSchema.fields,
  createdBy: UserSchema,
});

/**
 * Type inference from schemas
 */
export type Post = Schema.Schema.Type<typeof PostSchema>;
export type PostWithUser = Schema.Schema.Type<typeof PostWithUserSchema>;

/**
 * Encoded types (for serialization)
 */
export type PostEncoded = Schema.Schema.Encoded<typeof PostSchema>;
export type PostWithUserEncoded = Schema.Schema.Encoded<
  typeof PostWithUserSchema
>;

/**
 * Schema for creating a new post
 */
export const CreatePostSchema = Schema.Struct({
  name: PostSchema.fields.name,
  createdById: Schema.String,
});

export type CreatePost = Schema.Schema.Type<typeof CreatePostSchema>;

/**
 * Schema for updating a post
 */
export const UpdatePostSchema = Schema.partial(
  Schema.Struct({
    name: PostSchema.fields.name,
  })
);

export type UpdatePost = Schema.Schema.Type<typeof UpdatePostSchema>;

/**
 * Schema for post filters/queries
 */
export const PostFilterSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  createdById: Schema.optional(Schema.String),
  createdAfter: Schema.optional(Schema.instanceOf(Date)),
  createdBefore: Schema.optional(Schema.instanceOf(Date)),
  limit: Schema.optional(
    Schema.Number.pipe(
      Schema.positive({ message: () => "Limit must be positive" }),
      Schema.lessThanOrEqualTo(100, {
        message: () => "Limit cannot exceed 100",
      })
    )
  ),
  offset: Schema.optional(
    Schema.Number.pipe(
      Schema.nonNegative({ message: () => "Offset cannot be negative" })
    )
  ),
});

export type PostFilter = Schema.Schema.Type<typeof PostFilterSchema>;

/**
 * Utility functions for validation and parsing
 */
export const parsePost = Schema.decodeUnknownSync(PostSchema);
export const parsePostSafe = Schema.decodeUnknown(PostSchema);
export const encodePost = Schema.encodeSync(PostSchema);
export const encodePostSafe = Schema.encode(PostSchema);

export const parsePostWithUser = Schema.decodeUnknownSync(PostWithUserSchema);
export const parsePostWithUserSafe = Schema.decodeUnknown(PostWithUserSchema);
export const encodePostWithUser = Schema.encodeSync(PostWithUserSchema);
export const encodePostWithUserSafe = Schema.encode(PostWithUserSchema);
