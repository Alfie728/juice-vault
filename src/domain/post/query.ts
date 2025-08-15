import { Prisma } from "@prisma/client";

import { UserQuery } from "../user/query";

/**
 * Prisma query configuration for basic Post fetching
 */
export const PostQuery = Prisma.validator<Prisma.PostDefaultArgs>()({});

/**
 * Prisma query configuration for Post with User relation
 */
export const PostWithUserQuery = Prisma.validator<Prisma.PostDefaultArgs>()({
  include: {
    createdBy: UserQuery,
  },
});
