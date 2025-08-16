import { TRPCError } from "@trpc/server";
import { Effect } from "effect";
import { z } from "zod";

import { S3Service } from "~/domain/infra/s3-service";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const uploadRouter = createTRPCRouter({
  // Get presigned URL for audio upload
  getAudioUploadUrl: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        contentType: z.string().default("audio/mpeg"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        const s3Service = yield* S3Service;

        // Generate a unique key for the file
        const timestamp = Date.now();
        const sanitizedFileName = input.fileName.replace(
          /[^a-zA-Z0-9.-]/g,
          "_"
        );
        const key = `${ctx.session.user.id}/${timestamp}-${sanitizedFileName}`;

        // Get presigned upload URL
        const result = yield* s3Service.getPresignedUploadUrl(
          `audio/${key}`,
          input.contentType,
          3600 // 1 hour expiry
        );

        return {
          uploadUrl: result.url,
          key: result.key,
          expiresIn: result.expiresIn,
          publicUrl: yield* s3Service.getPublicUrl(result.key),
        };
      });

      return ctx.runtime.runPromise(
        program.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Failed to generate upload URL: ${error.message}`,
              })
            )
          )
        )
      );
    }),

  // Get presigned URL for cover art upload
  getCoverUploadUrl: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        const s3Service = yield* S3Service;

        // Generate a unique key for the file
        const timestamp = Date.now();
        const sanitizedFileName = input.fileName.replace(
          /[^a-zA-Z0-9.-]/g,
          "_"
        );
        const key = `${ctx.session.user.id}/${timestamp}-${sanitizedFileName}`;

        // Get presigned upload URL
        const result = yield* s3Service.getPresignedUploadUrl(
          `covers/${key}`,
          input.contentType,
          3600 // 1 hour expiry
        );

        return {
          uploadUrl: result.url,
          key: result.key,
          expiresIn: result.expiresIn,
          publicUrl: yield* s3Service.getPublicUrl(result.key),
        };
      });

      return ctx.runtime.runPromise(
        program.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Failed to generate upload URL: ${error.message}`,
              })
            )
          )
        )
      );
    }),

  // Delete a file
  deleteFile: protectedProcedure
    .input(
      z.object({
        key: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        const s3Service = yield* S3Service;

        // Check if user owns this file (key should start with user ID)
        if (!input.key.includes(ctx.session.user.id)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to delete this file",
          });
        }

        return yield* s3Service.delete(input.key);
      });

      return ctx.runtime.runPromise(
        program.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Failed to delete file: ${error.message}`,
              })
            )
          )
        )
      );
    }),

  // Get file metadata
  getFileMetadata: protectedProcedure
    .input(
      z.object({
        key: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        const s3Service = yield* S3Service;
        return yield* s3Service.getMetadata(input.key);
      });

      return ctx.runtime.runPromise(
        program.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new TRPCError({
                code: "NOT_FOUND",
                message: `File not found: ${error.message}`,
              })
            )
          )
        )
      );
    }),

  // Get presigned download URL
  getDownloadUrl: protectedProcedure
    .input(
      z.object({
        key: z.string(),
        expiresIn: z.number().min(60).max(86400).default(3600),
      })
    )
    .query(async ({ input, ctx }) => {
      const program = Effect.gen(function* () {
        const s3Service = yield* S3Service;

        return yield* s3Service.getPresignedDownloadUrl(input.key, {
          expiresIn: input.expiresIn,
        });
      });

      return ctx.runtime.runPromise(
        program.pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Failed to generate download URL: ${error.message}`,
              })
            )
          )
        )
      );
    }),
});
