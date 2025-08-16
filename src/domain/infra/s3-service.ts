import { Readable } from "stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Config, Data, Effect, Layer, pipe } from "effect";

// Error types
export class S3Error extends Data.TaggedError("S3Error")<{
  message: string;
  cause?: unknown;
}> {}

export class S3ConfigError extends Data.TaggedError("S3ConfigError")<{
  message: string;
}> {}

// Configuration schema
export interface S3Config {
  readonly region: string;
  readonly bucketName: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly endpoint?: string; // Optional for services like MinIO or LocalStack
}

// File metadata interface
export interface FileMetadata {
  readonly key: string;
  readonly size: number;
  readonly contentType?: string;
  readonly lastModified?: Date;
  readonly etag?: string;
}

// Upload input interface
export interface UploadInput {
  readonly key: string;
  readonly body: Buffer | Uint8Array | string | Readable;
  readonly contentType?: string;
  readonly metadata?: Record<string, string>;
  readonly cacheControl?: string;
}

// Presigned URL options
export interface PresignedUrlOptions {
  readonly expiresIn?: number; // seconds, default 3600 (1 hour)
  readonly responseContentDisposition?: string;
  readonly responseContentType?: string;
}

// S3 Service Definition
export class S3Service extends Effect.Service<S3Service>()("S3Service", {
  effect: Effect.gen(function* () {
    // Load configuration from environment or config
    const config = yield* Effect.all({
      region: Config.string("AWS_REGION").pipe(Config.withDefault("us-east-1")),
      bucketName: Config.string("S3_BUCKET_NAME").pipe(
        Config.withDefault("juice-vault-music")
      ),
      accessKeyId: Config.string("AWS_ACCESS_KEY_ID"),
      secretAccessKey: Config.string("AWS_SECRET_ACCESS_KEY"),
      endpoint: Config.string("S3_ENDPOINT").pipe(
        Config.withDefault(undefined)
      ),
    });

    // Create S3 client
    const s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
    });

    return {
      // Upload a file to S3
      upload: (input: UploadInput) =>
        Effect.tryPromise({
          try: async () => {
            const command = new PutObjectCommand({
              Bucket: config.bucketName,
              Key: input.key,
              Body: input.body,
              ContentType: input.contentType,
              Metadata: input.metadata,
              CacheControl: input.cacheControl,
            });

            const response = await s3Client.send(command);

            return {
              key: input.key,
              etag: response.ETag,
              versionId: response.VersionId,
              url: `https://${config.bucketName}.s3.${config.region}.amazonaws.com/${input.key}`,
            };
          },
          catch: (error) =>
            new S3Error({
              message: `Failed to upload file ${input.key}`,
              cause: error,
            }),
        }).pipe(
          Effect.withSpan("S3Service.upload", {
            attributes: {
              "s3.bucket": config.bucketName,
              "s3.key": input.key,
            },
          })
        ),

      // Upload audio file with specific settings
      uploadAudio: (
        key: string,
        body: Buffer | Uint8Array | Readable,
        contentType = "audio/mpeg"
      ) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () => {
              const command = new PutObjectCommand({
                Bucket: config.bucketName,
                Key: `audio/${key}`,
                Body: body,
                ContentType: contentType,
                CacheControl: "max-age=31536000", // Cache for 1 year
                Metadata: {
                  type: "audio",
                  uploadedAt: new Date().toISOString(),
                },
              });

              const response = await s3Client.send(command);

              // Generate a presigned URL for immediate use
              const presignedUrl = await getSignedUrl(
                s3Client,
                new GetObjectCommand({
                  Bucket: config.bucketName,
                  Key: `audio/${key}`,
                }),
                { expiresIn: 86400 }
              ); // 24 hours

              return {
                key: `audio/${key}`,
                etag: response.ETag,
                url: presignedUrl,
                publicUrl: `https://${config.bucketName}.s3.${config.region}.amazonaws.com/audio/${key}`,
              };
            },
            catch: (error) =>
              new S3Error({
                message: `Failed to upload audio file ${key}`,
                cause: error,
              }),
          });

          return result;
        }).pipe(Effect.withSpan("S3Service.uploadAudio")),

      // Upload cover art with optimization
      uploadCoverArt: (
        key: string,
        body: Buffer | Uint8Array,
        contentType = "image/jpeg"
      ) =>
        Effect.tryPromise({
          try: async () => {
            const command = new PutObjectCommand({
              Bucket: config.bucketName,
              Key: `covers/${key}`,
              Body: body,
              ContentType: contentType,
              CacheControl: "max-age=31536000", // Cache for 1 year
              Metadata: {
                type: "cover",
                uploadedAt: new Date().toISOString(),
              },
            });

            const response = await s3Client.send(command);

            return {
              key: `covers/${key}`,
              etag: response.ETag,
              url: `https://${config.bucketName}.s3.${config.region}.amazonaws.com/covers/${key}`,
            };
          },
          catch: (error) =>
            new S3Error({
              message: `Failed to upload cover art ${key}`,
              cause: error,
            }),
        }).pipe(Effect.withSpan("S3Service.uploadCoverArt")),

      // Download a file from S3
      download: (key: string) =>
        Effect.tryPromise({
          try: async () => {
            const command = new GetObjectCommand({
              Bucket: config.bucketName,
              Key: key,
            });

            const response = await s3Client.send(command);

            if (!response.Body) {
              throw new Error("Empty response body");
            }

            // Convert stream to buffer
            const stream = response.Body as Readable;
            const chunks: Uint8Array[] = [];

            for await (const chunk of stream) {
              chunks.push(chunk as Uint8Array);
            }

            return {
              body: Buffer.concat(chunks),
              contentType: response.ContentType,
              contentLength: response.ContentLength,
              etag: response.ETag,
              lastModified: response.LastModified,
            };
          },
          catch: (error) =>
            new S3Error({
              message: `Failed to download file ${key}`,
              cause: error,
            }),
        }).pipe(
          Effect.withSpan("S3Service.download", {
            attributes: {
              "s3.bucket": config.bucketName,
              "s3.key": key,
            },
          })
        ),

      // Get file metadata without downloading
      getMetadata: (key: string) =>
        Effect.tryPromise({
          try: async () => {
            const command = new HeadObjectCommand({
              Bucket: config.bucketName,
              Key: key,
            });

            const response = await s3Client.send(command);

            return {
              key,
              size: response.ContentLength ?? 0,
              contentType: response.ContentType,
              lastModified: response.LastModified,
              etag: response.ETag,
            } satisfies FileMetadata;
          },
          catch: (error) =>
            new S3Error({
              message: `Failed to get metadata for file ${key}`,
              cause: error,
            }),
        }).pipe(Effect.withSpan("S3Service.getMetadata")),

      // Delete a file from S3
      delete: (key: string) =>
        Effect.tryPromise({
          try: async () => {
            const command = new DeleteObjectCommand({
              Bucket: config.bucketName,
              Key: key,
            });

            await s3Client.send(command);

            return { deleted: true, key };
          },
          catch: (error) =>
            new S3Error({
              message: `Failed to delete file ${key}`,
              cause: error,
            }),
        }).pipe(
          Effect.withSpan("S3Service.delete", {
            attributes: {
              "s3.bucket": config.bucketName,
              "s3.key": key,
            },
          })
        ),

      // Delete multiple files
      deleteMany: (keys: string[]) =>
        Effect.forEach(
          keys,
          (key) =>
            Effect.tryPromise({
              try: async () => {
                const command = new DeleteObjectCommand({
                  Bucket: config.bucketName,
                  Key: key,
                });
                await s3Client.send(command);
                return key;
              },
              catch: (error) =>
                new S3Error({
                  message: `Failed to delete file ${key}`,
                  cause: error,
                }),
            }),
          { concurrency: 5 } // Process 5 deletions concurrently
        ).pipe(
          Effect.map((deletedKeys) => ({
            deleted: deletedKeys.length,
            keys: deletedKeys,
          })),
          Effect.withSpan("S3Service.deleteMany")
        ),

      // Generate a presigned URL for download
      getPresignedDownloadUrl: (key: string, options?: PresignedUrlOptions) =>
        Effect.tryPromise({
          try: async () => {
            const command = new GetObjectCommand({
              Bucket: config.bucketName,
              Key: key,
              ResponseContentDisposition: options?.responseContentDisposition,
              ResponseContentType: options?.responseContentType,
            });

            const url = await getSignedUrl(s3Client, command, {
              expiresIn: options?.expiresIn ?? 3600, // Default 1 hour
            });

            return { url, expiresIn: options?.expiresIn ?? 3600 };
          },
          catch: (error) =>
            new S3Error({
              message: `Failed to generate presigned URL for ${key}`,
              cause: error,
            }),
        }).pipe(Effect.withSpan("S3Service.getPresignedDownloadUrl")),

      // Generate a presigned URL for upload
      getPresignedUploadUrl: (
        key: string,
        contentType?: string,
        expiresIn = 3600
      ) =>
        Effect.tryPromise({
          try: async () => {
            const command = new PutObjectCommand({
              Bucket: config.bucketName,
              Key: key,
              ContentType: contentType,
            });

            const url = await getSignedUrl(s3Client, command, {
              expiresIn,
            });

            return {
              url,
              key,
              expiresIn,
              fields: {
                key,
                bucket: config.bucketName,
                contentType,
              },
            };
          },
          catch: (error) =>
            new S3Error({
              message: `Failed to generate presigned upload URL for ${key}`,
              cause: error,
            }),
        }).pipe(Effect.withSpan("S3Service.getPresignedUploadUrl")),

      // Check if a file exists
      exists: (key: string) =>
        pipe(
          Effect.tryPromise({
            try: async () => {
              const command = new HeadObjectCommand({
                Bucket: config.bucketName,
                Key: key,
              });

              await s3Client.send(command);
              return true;
            },
            catch: () => false,
          }),
          Effect.withSpan("S3Service.exists")
        ),

      // Get the public URL for a file (if bucket is public)
      getPublicUrl: (key: string) =>
        Effect.succeed(
          `https://${config.bucketName}.s3.${config.region}.amazonaws.com/${key}`
        ),

      // Get configuration (useful for debugging)
      getConfig: () =>
        Effect.succeed({
          region: config.region,
          bucketName: config.bucketName,
          hasEndpoint: !!config.endpoint,
        }),
    };
  }),
  accessors: true,
}) {}
