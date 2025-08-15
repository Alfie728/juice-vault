import { Schema } from "@effect/schema";

/**
 * User Schema using Effect's Schema
 * Provides runtime validation, encoding/decoding, and type inference
 */
export const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String.pipe(
    Schema.filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), {
      message: () => "Invalid email format",
    })
  ),
  image: Schema.String.pipe(
    Schema.filter(
      (s) => {
        try {
          new URL(s);
          return true;
        } catch {
          return false;
        }
      },
      {
        message: () => "Invalid URL format",
      }
    )
  ),
  emailVerified: Schema.optional(Schema.instanceOf(Date)),
});

/**
 * Type inference from the schema
 */
export type User = Schema.Schema.Type<typeof UserSchema>;

/**
 * Encoded type (for serialization)
 */
export type UserEncoded = Schema.Schema.Encoded<typeof UserSchema>;

/**
 * Schema for creating a new user (without id and timestamps)
 */
export const CreateUserSchema = Schema.Struct({
  name: Schema.String,
  email: UserSchema.fields.email,
  image: Schema.optional(UserSchema.fields.image),
});

export type CreateUser = Schema.Schema.Type<typeof CreateUserSchema>;

/**
 * Schema for updating a user (all fields optional)
 */
export const UpdateUserSchema = Schema.partial(
  Schema.Struct({
    name: Schema.String,
    email: UserSchema.fields.email,
    image: UserSchema.fields.image,
    emailVerified: Schema.instanceOf(Date),
  })
);

export type UpdateUser = Schema.Schema.Type<typeof UpdateUserSchema>;

/**
 * Utility functions for validation and parsing
 */
export const decodeUser = Schema.decodeUnknown(UserSchema);
export const encodeUser = Schema.encode(UserSchema);
