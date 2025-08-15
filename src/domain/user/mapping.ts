import type { UserQuery } from "../user/query";
import type { User } from "./schema";
import type { Prisma } from "@prisma/client";
import { Schema } from "@effect/schema";
import { Effect, pipe } from "effect";

import { ValidationError } from "~/domain/errors";

import { UserSchema } from "./schema";

/**
 * Maps Prisma User to domain User type using Effect
 * Includes validation to ensure data integrity
 */
export const PrismaUserToUser = (
  user: Prisma.UserGetPayload<typeof UserQuery>
): Effect.Effect<User, ValidationError> => {
  const userData = {
    id: user.id,
    name: user.name ?? "",
    email: user.email ?? "",
    image: user.image ?? "",
    emailVerified: user.emailVerified ?? undefined,
  };

  return pipe(
    Schema.decodeUnknown(UserSchema)(userData),
    Effect.mapError(
      (error) =>
        new ValidationError({
          field: "user",
          reason: String(error),
        })
    )
  );
};

/**
 * Maps domain User to Prisma create input
 */
export const UserToPrismaCreate = (user: Omit<User, "id">) => ({
  name: user.name,
  email: user.email,
  image: user.image,
  emailVerified: user.emailVerified,
});

/**
 * Maps domain User to Prisma update input
 */
export const UserToPrismaUpdate = (user: Partial<User>) => {
  const update: Prisma.UserUpdateInput = {};

  if (user.name !== undefined) update.name = user.name;
  if (user.email !== undefined) update.email = user.email;
  if (user.image !== undefined) update.image = user.image;
  if (user.emailVerified !== undefined)
    update.emailVerified = user.emailVerified;

  return update;
};
